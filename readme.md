# Minecraft modpack uploader action

This action uploads a [pax](https://github.com/froehlichA/pax) modpack to a remote FTP server, including fetching and uploading any mods not already present on the server.


## Required Inputs

### `curse-api-key`

CurseForge Core API key. For more info, [see CurseForge docs](https://docs.curseforge.com/#getting-started);

### `ftp-user`

FTP username

### `ftp-password`

FTP password

### `ftp-host`

FTP server URL


## Optional Inputs

### `ftp-port`

FTP server port (default 21)

### `local-root`

Path to root of local pax repo (default '.')

### `remote-root`

Base dir of remote FTP server to upload to (default '/')


## Example usage

```yaml
on: [push]

jobs:
  upload_pack:
    runs-on: ubuntu-latest
    name: Upload pack to server
    steps:
      # checkout the repo
      - name: Checkout
        uses: actions/checkout@v3
      # upload action
      - name: FTP upload
        uses: trashbyte/modpack-ftp-action@v1.0
        with:
          curse-api-key: ${{ secrets.curse_api_key }}
          ftp-host: 'example.com'
          ftp-user: 'username'
          ftp-password: ${{ secrets.ftp_password }}
          remote-root: '/servers/my-server/'
```
