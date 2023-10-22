const http = require('http');
const https = require('https');
const fs = require('fs');
const { Storage } = require('@google-cloud/storage');
const axios = require('axios');
const path = require('path')


const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET_NAME;

async function uploadFile(
    fileId,
    filePath,
    destFileName,
    generationMatchPrecondition = 0
) {
    const storage = new Storage({ keyFilename: './application_default_credentials.json' });

    async function uploadFile() {

        const bucket = storage.bucket(bucketName);
        var ext = path.extname(destFileName);
        const standardFileName = getStandardCloudFileName(fileId, destFileName);
        const tempFile = `./tmp/${standardFileName}${ext}`;
        await download(filePath, tempFile);

        let destFile = bucket.file(`${standardFileName}${ext}`);
        const metadata = {
            metadata: {
                extension: ext
            }
        };
        const fileExists = await destFile.exists();
        if (!fileExists[0]) {
            const options = {
                destination: `${standardFileName}${ext}`,
                preconditionOpts: { ifGenerationMatch: generationMatchPrecondition },
            };
            const fileUploadResponse = await bucket.upload(tempFile, options);
            fs.unlinkSync(tempFile);
            const uploadedFile = fileUploadResponse[0];
            await uploadedFile.setMetadata(metadata);
            return await generateSignedUrl(uploadedFile)
            .then((url) => {
                if (url) {
                    return url;
                } else {
                    return null;
                }
            });
        }

        // This can happen in an unlikely scenario where multiple people requested to dowload the same file for at the same time for the first time
        return null;
    }

    uploadFile().catch(console.error);
}

function getStandardCloudFileName(fileID, fileName = null) {
    //for now we just return the fileID as standard file name. Might flesh out a proper way to manage this later
    return `${fileID}`;
}

async function getCloudFileUrlIfExists(fileID, fileName) {
    try {
        const storage = new Storage({ keyFilename: './application_default_credentials.json' });
        const bucket = storage.bucket(bucketName);
        const file = bucket.file(getStandardCloudFileName(fileID, fileName));
        const [fileExists] = await bucket.getFiles({ prefix: fileID });
        if (fileExists && fileExists[0]) {
            const generatedUrl = await generateSignedUrl(fileExists[0])
                .then((url) => {
                    if (url) {
                        return url;
                    } else {
                        return null;
                    }
                });
            return generatedUrl;
        }
    }
    catch (err) {
        console.log(err);
    }

    return null;
}

async function generateSignedUrl(objFile) {
    try {
        const config = {
            version: 'v4',
            action: 'read',
            expires: Date.now() + 1000 * 60 * 60, // valid for one hour
        }
        const [url] = await objFile.getSignedUrl(config);
        return url;
    } catch (err) {
        console.log(err)
        return null;
    }
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