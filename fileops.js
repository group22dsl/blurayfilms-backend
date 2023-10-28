const fs = require('fs');
const { Storage } = require('@google-cloud/storage');
const axios = require('axios');
const path = require('path')
const request = require('request');


const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET_NAME;

async function uploadFile(
    movieId,
    fileId,
    filePath,
    destFileName,
    generationMatchPrecondition = 0
) {

    const storage = new Storage({ keyFilename: './application_default_credentials.json' });
    const bucket = storage.bucket(bucketName);
    var ext = path.extname(destFileName);
    const standardFileName = getStandardCloudFileName(movieId,fileId, destFileName);
    let destFile = bucket.file(`${standardFileName}${ext}`);
    const tempFile = `./tmp/dummyfile`;
    const metadata = {
        metadata: {
            extension: ext
        }
    };
    const fileExists = await destFile.exists();
    if (!fileExists[0]) {
        const uploadblob = (url, file) => {
            return new Promise((resolve, reject) => {
                request.head(url, (err, res, body) => {
                    request(url)
                        .pipe(file.createWriteStream())
                        .on('close', () => {
                            resolve();
                        })
                        .on('error', (err) => {
                            reject(err);
                        });
                });
            });
        };

        const url = filePath;
        await uploadblob(url, destFile);
        await destFile.setMetadata(metadata);

        const blobUrl = await generateSignedUrl(destFile)
            .then((url) => {
                if (url) {
                    return url;
                } else {
                    return null;
                }
            });
        
        return blobUrl;
    }
    // This can happen in an unlikely scenario where multiple people requested to dowload the same file at the same time for the first time
    return null;
}

function getStandardCloudFileName(movieID, fileID, fileName = null) {
    //for now we just return the fileID as standard file name. Might flesh out a proper way to manage this later
    return `${movieID}_${fileID}`;
}

async function getCloudFileUrlIfExists(movieID, fileID, fileName) {
    try {
        const storage = new Storage({ keyFilename: './application_default_credentials.json' });
        const bucket = storage.bucket(bucketName);
        const filePrefix = getStandardCloudFileName(movieID, fileID, fileName);
        const [fileExists] = await bucket.getFiles({ prefix: filePrefix });
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

module.exports = { uploadFile, getCloudFileUrlIfExists };