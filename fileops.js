const http = require('http');
const https = require('https');
const fs = require('fs');
const { Storage } = require('@google-cloud/storage');
const axios = require('axios');
const path = require('path')


const bucketName = 'bluraymoviesubtitles';

async function uploadFile(
    fileId,
    filePath,
    destFileName,
    generationMatchPrecondition = 0
) {
    const storage = new Storage({ keyFilename: './application_default_credentials.json' });

    async function uploadFile() {

        const bucket = storage.bucket(bucketName);
        const standardFileName = getStandardCloudFileName(fileId, destFileName);
        const tempFile = `./tmp/${standardFileName}`;
        await download(filePath, tempFile);
        let file = bucket.file(standardFileName);
        var ext = path.extname(destFileName);
        const metadata = {
            metadata: {
                extension: ext
            }
        };
        const fileExists = await file.exists();
        if (!fileExists[0]) {
            const options = {
                destination: standardFileName,
                preconditionOpts: { ifGenerationMatch: generationMatchPrecondition },
            };
            //TODO: set file extension as metadata
            await bucket.upload(tempFile, options);
            file.setMetadata(metadata);

        }
        fs.unlinkSync(tempFile);
        return getCloudFileUrl(fileId);

    }

    uploadFile().catch(console.error);
}

function getStandardCloudFileName(fileID, fileName = null) {
    return `${fileID}`;
}

async function getCloudFileUrlIfExists(fileID, fileName) {
    const storage = new Storage({ keyFilename: './application_default_credentials.json' });
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(getStandardCloudFileName(fileID, fileName));
    const fileExists = await file.exists();
    if (fileExists[0]) {
        return getCloudFileUrl(fileID, fileName);
    }
    return null;
}

async function generateSignedUrl(fileID, fileName) {
    try {
        const config = {
            version: 'v4',
            action: 'read',
            expires: Date.now() + 1000 * 60 * 60, // valid for one hour
        }
    const storage = new Storage({ keyFilename: './application_default_credentials.json' });
      const [url] = await storage.bucket(bucketName).file(getStandardCloudFileName(fileID, fileName)).getSignedUrl(config);
      return url;
    } catch (err) {
      return null;
    }
  }

async function getCloudFileUrl(fileID, fileName) {
    const config = {
        version: 'v4',
        action: 'read',
        expires: Date.now() + 1000 * 60 * 60,
    }

    const storage = new Storage({ keyFilename: './application_default_credentials.json' });
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(getStandardCloudFileName(fileID));
    const fileExists = await file.exists();
    if (fileExists[0]) {
        
    }
      generateSignedUrl(fileID, fileName)
        .then((url) => {
          if (url) {
          } else {
          }
        });
}

async function download(url, filePath) {
    const proto = !url.charAt(4).localeCompare('s') ? https : http;
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filePath);
        let fileInfo = null;

        const request = proto.get(url, response => {
            if (response.statusCode !== 200) {
                fs.unlink(filePath, () => {
                    reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
                });
                return;
            }

            fileInfo = {
                mime: response.headers['content-type'],
                size: parseInt(response.headers['content-length'], 10),
            };

            response.pipe(file);
        });

        file.on('finish', () => resolve(fileInfo));
        request.on('error', err => {
            fs.unlink(filePath, () => reject(err));
        });
        file.on('error', err => {
            fs.unlink(filePath, () => reject(err));
        });

        request.end();
    });
}

module.exports = { uploadFile, getCloudFileUrlIfExists };