import fetch from 'node-fetch'
const core = require('@actions/core')
const FtpClient = require('ftp')
const FtpDeploy = require('ftp-deploy')
const download = require('download')
const fs = require('fs')
const print = (m) => process.stdout.write(m)
const println = (m) => console.log(m)


// error catcher
try {
	run()
}
catch (error) {
  core.setFailed(error.message)
}


async function upload(filename, remote_root, ftp_config) {
	let c = new FtpClient()
	return new Promise((resolve, reject) => {
		c.on('ready', () => {
			c.put('./dl/'+filename, remote_root+'mods/'+filename, err => {
				if (err) reject(err)
				c.end()
			  resolve()
			})
		})
		c.connect(ftp_config)
	})
}


async function ls(remote_root, ftp_config) {
	let c = new FtpClient()
	return new Promise((resolve, reject) => {
		c.on('ready', () => {
			c.list(remote_root+'mods', (err, list) => {
				if (err) reject(err)
				c.end()
			  resolve(list)
			})
		})
		c.connect(ftp_config)
	})
}


async function run() {
	// get action inputs

	const ftp_config = {
		host: core.getInput('ftp-host'),
		port: parseInt(core.getInput('ftp-port')),
		user: core.getInput('ftp-user'),
		password: core.getInput('ftp-password'),
	}
	const api_key = core.getInput('curse-api-key')
	let local_root = core.getInput('local-root')
	if (!local_root.endsWith('/')) {
		local_root += '/'
	}
	let remote_root = core.getInput('remote-root')
	if (!remote_root.endsWith('/')) {
		remote_root += '/'
	}

	// read manifest

	if (!fs.existsSync(local_root+'modpack/manifest.json')) {
		throw '/modpack/manifest.json is missing, cannot continue.'
	}

	let manifest = fs.readFileSync('modpack/manifest.json')
	manifest = JSON.parse(manifest)
	if (!manifest.files) {
		throw "malformed manifest: 'files' field missing"
	}

	// upload overrides

	print(`Uploading overrides... `)
	await new FtpDeploy().deploy({
		user: ftp_config.user,
		password: ftp_config.password,
		host: ftp_config.host,
		localRoot: local_root+'modpack/overrides',
		include: ["*", "**/*"],
		remoteRoot: remote_root
	})
	println("done.")

	// enumerate existing mods

	const existing_data = await ls(remote_root, ftp_config)
	let existing = {}
	for (let e of existing_data) {
		existing[e.name] = parseInt(e.size)
	}

	// download and push new mods

	for (let entry of manifest.files) {
		let mod_name = ''
		if (entry.__meta) {
			mod_name = entry.__meta.name ? ` (${entry.__meta.name})` : ''
		}
		println(`Getting info for ${entry.projectID}:${entry.fileID}${mod_name}...`)
		
		// query curse for mod filename

		const response = await fetch(`https://api.curseforge.com/v1/mods/${entry.projectID}/files/${entry.fileID}`, {
			method: 'get',
			headers: { 'Accept': 'application/json', 'x-api-key': api_key }
		})
		if (response.ok) {
			// parse response

			const data = await response.json()
			if (!data.data) {
				throw 'Unexpected response: no "data" field.'
			}

			const filename = data.data.fileName
			if (!filename) { throw 'Unexpected response: no "data.fileName" field.' }
			
			const url = data.data.downloadUrl
			if (!url) { throw 'Unexpected response: no "data.downloadUrl" field.' }

			print(`Checking FTP server for ${filename}... `)

			let need_file = true
			if (Object.keys(existing).includes(filename)) {
				print('already exists, ')
				if (existing[filename] == data.data.fileLength) {
					println('same size.')
					need_file = false
				}
				else {
					println(`different size (curse ${data.data.fileLength} remote ${existing[filename]}).`)
				}
			}
			else {
				println('missing.')
			}
			if (need_file) {
				print(`Downloading from ${url}... `)

				// ensure /dl exists
				if (!fs.existsSync('dl')) {
				    fs.mkdirSync('dl')
				}

				// download file
				await download(url, `./dl`)

				// upload to FTP server
				print(`uploading... `)
				await upload(filename, remote_root, ftp_config)
				println('done.')
			}
		}
		else {
			throw `HTTP Error Response: ${response.status} ${response.statusText}`
		}
	}
}
