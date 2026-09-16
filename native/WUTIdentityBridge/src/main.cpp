#include <wups.h>

#include <coreinit/thread.h>
#include <coreinit/time.h>
#include <coreinit/title.h>
#include <nn/act/client_cpp.h>
#include <nn/ffl/miidata.h>
#include <arpa/inet.h>
#include <netinet/in.h>
#include <sys/socket.h>
#include <unistd.h>

#include <cstdint>
#include <cstdio>
#include <cstring>

WUPS_PLUGIN_NAME("WUT Identity Bridge");
WUPS_PLUGIN_DESCRIPTION("Automatic current-account/Mii bridge for WUT-Miiverse");
WUPS_PLUGIN_VERSION("0.1.5-test04");
WUPS_PLUGIN_AUTHOR("Makii");
WUPS_PLUGIN_LICENSE("MIT");

WUPS_USE_WUT_DEVOPTAB();

static constexpr uint8_t SERVER_IP_A = 192;
static constexpr uint8_t SERVER_IP_B = 168;
static constexpr uint8_t SERVER_IP_C = 1;
static constexpr uint8_t SERVER_IP_D = 75;
static constexpr uint16_t SERVER_PORT = 80;
static constexpr const char *SERVER_HOST = "192.168.1.75";

static constexpr const char *REGISTER_PATH =
    "/WUT-miiverse/net/olv/v1/native/register.php";
static constexpr const char *DIAG_PATH =
    "/WUT-miiverse/net/olv/v1/native/diag.php";

static constexpr const char *BRIDGE_SECRET =
    "1a1298059f613adddb70bce21b75abc5b6c42dba29fa5f53fe9a0a20c717cc68";

static constexpr uint64_t WIIU_MENU_JPN = 0x0005001010040000ULL;
static constexpr uint64_t WIIU_MENU_USA = 0x0005001010040100ULL;
static constexpr uint64_t WIIU_MENU_EUR = 0x0005001010040200ULL;

static constexpr uint64_t MIIVERSE_JPN = 0x000500301001600AULL;
static constexpr uint64_t MIIVERSE_USA = 0x000500301001610AULL;
static constexpr uint64_t MIIVERSE_EUR = 0x000500301001620AULL;

static OSThread gWorkerThread;
alignas(0x20) static uint8_t gWorkerStack[0x10000];
static uint64_t gTitleId = 0;

static bool ShouldRunIdentityBridge(uint64_t titleId) {
    return titleId == WIIU_MENU_JPN ||
           titleId == WIIU_MENU_USA ||
           titleId == WIIU_MENU_EUR ||
           titleId == MIIVERSE_JPN ||
           titleId == MIIVERSE_USA ||
           titleId == MIIVERSE_EUR;
}

static void BytesToHex(const uint8_t *data, size_t size, char *out) {
    static const char hex[] = "0123456789abcdef";
    for (size_t i = 0; i < size; ++i) {
        out[i * 2] = hex[(data[i] >> 4) & 0x0F];
        out[i * 2 + 1] = hex[data[i] & 0x0F];
    }
    out[size * 2] = '\0';
}

static bool SendAll(int fd, const char *data, size_t size) {
    size_t total = 0;
    while (total < size) {
        int sent = send(fd, data + total, size - total, 0);
        if (sent <= 0) {
            return false;
        }
        total += static_cast<size_t>(sent);
    }
    return true;
}

static bool HttpPostJson(const char *path, const char *body) {
    const size_t bodyLength = std::strlen(body);

    char request[2048];
    int requestLength = std::snprintf(
        request, sizeof(request),
        "POST %s HTTP/1.1\r\n"
        "Host: %s\r\n"
        "Content-Type: application/json\r\n"
        "Content-Length: %u\r\n"
        "Connection: close\r\n\r\n%s",
        path,
        SERVER_HOST,
        static_cast<unsigned int>(bodyLength),
        body
    );

    if (requestLength <= 0 || static_cast<size_t>(requestLength) >= sizeof(request)) {
        return false;
    }

    int fd = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if (fd < 0) {
        return false;
    }

    sockaddr_in address;
    std::memset(&address, 0, sizeof(address));
    address.sin_family = AF_INET;
    address.sin_port = htons(SERVER_PORT);
    address.sin_addr.s_addr = htonl(
        (static_cast<uint32_t>(SERVER_IP_A) << 24) |
        (static_cast<uint32_t>(SERVER_IP_B) << 16) |
        (static_cast<uint32_t>(SERVER_IP_C) << 8) |
        static_cast<uint32_t>(SERVER_IP_D)
    );

    if (connect(fd, reinterpret_cast<sockaddr *>(&address), sizeof(address)) < 0) {
        close(fd);
        return false;
    }

    const bool sent = SendAll(fd, request, static_cast<size_t>(requestLength));

    if (sent) {
        char response[256];
        (void) recv(fd, response, sizeof(response), 0);
    }

    close(fd);
    return sent;
}

static void ReportStage(const char *stage, int attempt) {
    char body[512];
    int len = std::snprintf(
        body, sizeof(body),
        "{\"secret\":\"%s\",\"stage\":\"%s\",\"attempt\":%d,"
        "\"title_id\":\"%08x%08x\",\"bridge_version\":\"0.1.3-test02\"}",
        BRIDGE_SECRET,
        stage,
        attempt,
        static_cast<unsigned int>(gTitleId >> 32),
        static_cast<unsigned int>(gTitleId & 0xffffffffULL)
    );

    if (len > 0 && static_cast<size_t>(len) < sizeof(body)) {
        (void) HttpPostJson(DIAG_PATH, body);
    }
}

static bool PostIdentity(
    const char *accountId,
    uint8_t slot,
    uint32_t pid,
    uint32_t persistentId,
    const FFLStoreData &mii
) {
    static_assert(sizeof(FFLStoreData) == 96, "FFLStoreData must be 96 bytes");

    char miiHex[193];
    BytesToHex(reinterpret_cast<const uint8_t *>(&mii), sizeof(mii), miiHex);

    char body[1024];
    int bodyLength = std::snprintf(
        body, sizeof(body),
        "{\"secret\":\"%s\",\"account_id\":\"%s\","
        "\"slot\":%u,\"pid\":%u,\"persistent_id\":%u,\"mii_data\":\"%s\"}",
        BRIDGE_SECRET,
        accountId,
        static_cast<unsigned int>(slot),
        pid,
        persistentId,
        miiHex
    );

    if (bodyLength <= 0 || static_cast<size_t>(bodyLength) >= sizeof(body)) {
        return false;
    }

    return HttpPostJson(REGISTER_PATH, body);
}

struct IdentitySnapshot {
    char accountId[nn::act::AccountIdSize];
    nn::act::SlotNo slot;
    uint32_t pid;
    uint32_t persistentId;
    FFLStoreData mii;
};

static bool ReadCurrentIdentity(IdentitySnapshot &out, const char **failureStage) {
    std::memset(&out, 0, sizeof(out));
    *failureStage = nullptr;

    nn::Result initResult = nn::act::Initialize();
    if (initResult.IsFailure()) {
        *failureStage = "act_init_failed";
        return false;
    }

    nn::Result accountResult = nn::act::GetAccountId(out.accountId);
    nn::Result miiResult = nn::act::GetMii(&out.mii);
    out.slot = nn::act::GetSlotNo();
    out.pid = nn::act::GetPrincipalId();
    out.persistentId = nn::act::GetPersistentId();

    nn::act::Finalize();

    if (accountResult.IsFailure()) {
        *failureStage = "account_id_failed";
        return false;
    }

    if (miiResult.IsFailure()) {
        *failureStage = "get_mii_failed";
        return false;
    }

    if (out.slot == 0) {
        *failureStage = "slot_invalid";
        return false;
    }

    if (out.pid == 0) {
        *failureStage = "pid_invalid";
        return false;
    }

    out.accountId[nn::act::AccountIdSize - 1] = '\0';
    if (out.accountId[0] == '\0') {
        *failureStage = "account_id_empty";
        return false;
    }

    return true;
}

static bool IdentityMatches(const IdentitySnapshot &a, const IdentitySnapshot &b) {
    return a.slot == b.slot &&
           a.pid == b.pid &&
           a.persistentId == b.persistentId &&
           std::strcmp(a.accountId, b.accountId) == 0 &&
           std::memcmp(&a.mii, &b.mii, sizeof(FFLStoreData)) == 0;
}

static int WorkerThreadMain(int, const char **) {
    OSSleepTicks(OSMillisecondsToTicks(900));
    ReportStage("worker_started", 0);

    IdentitySnapshot lastIdentity;
    std::memset(&lastIdentity, 0, sizeof(lastIdentity));
    bool haveLastIdentity = false;
    int attempt = 0;

    /*
     * Keep watching the currently active Wii U account for as long as this
     * title process is alive. We only POST when the account or its 96-byte
     * FFLStoreData changes. This makes the bridge follow the real logged-in
     * user instead of pinning WUT to the first account seen at startup.
     */
    while (true) {
        ++attempt;

        IdentitySnapshot currentIdentity;
        const char *failureStage = nullptr;

        if (!ReadCurrentIdentity(currentIdentity, &failureStage)) {
            ReportStage(failureStage != nullptr ? failureStage : "identity_read_failed", attempt);
            OSSleepTicks(OSMillisecondsToTicks(3000));
            continue;
        }

        const bool changed = !haveLastIdentity ||
                             !IdentityMatches(currentIdentity, lastIdentity);

        if (changed) {
            const bool wasKnown = haveLastIdentity;
            ReportStage(wasKnown ? "identity_changed" : "identity_ready", attempt);

            if (PostIdentity(
                    currentIdentity.accountId,
                    static_cast<uint8_t>(currentIdentity.slot),
                    currentIdentity.pid,
                    currentIdentity.persistentId,
                    currentIdentity.mii)) {
                std::memcpy(&lastIdentity, &currentIdentity, sizeof(lastIdentity));
                haveLastIdentity = true;
                ReportStage(wasKnown ? "identity_updated" : "identity_posted", attempt);
            } else {
                /* Do not update lastIdentity: retry this same current user. */
                ReportStage("identity_post_failed", attempt);
            }
        }

        OSSleepTicks(OSMillisecondsToTicks(3000));
    }

    return 0;
}

ON_APPLICATION_START() {
    gTitleId = OSGetTitleID();

    if (!ShouldRunIdentityBridge(gTitleId)) {
        return;
    }

    /*
     * Modern WUT exposes BSD/POSIX sockets directly through the standard
     * socket headers. socket_lib_init() was removed from current WUT, so no
     * legacy nsysnet initialization is performed here.
     */
    ReportStage("plugin_started", 0);

    std::memset(&gWorkerThread, 0, sizeof(gWorkerThread));

    const OSThreadAttributes attributes =
        static_cast<OSThreadAttributes>(
            OS_THREAD_ATTRIB_AFFINITY_ANY |
            OS_THREAD_ATTRIB_DETACHED
        );

    if (OSCreateThread(
            &gWorkerThread,
            WorkerThreadMain,
            0,
            nullptr,
            gWorkerStack + sizeof(gWorkerStack),
            sizeof(gWorkerStack),
            16,
            attributes)) {
        OSSetThreadName(&gWorkerThread, "WUTIdentityBridge");
        OSResumeThread(&gWorkerThread);
    } else {
        ReportStage("worker_create_failed", 0);
    }
}
