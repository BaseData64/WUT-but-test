docker build -t wut-identity-builder .
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

docker run --rm `
  -v "${PWD}:/project" `
  -w /project `
  wut-identity-builder
