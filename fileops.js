const fs = require('fs');
const { Storage } = require('@google-cloud/storage');
const axios = require('axios');
const path = require('path')
const request = require('request');


const bucketNameSubtitles = process.env.GOOGLE_CLOUD_STORAGE_BUCKET_NAME_SUBTITLES;
const bucketNameFiles = process.env.GOOGLE_CLOUD_STORAGE_BUCKET_NAME_FILES;

async function uploadFile(
    movieId,
    fileId,
    filePath,
    destFileName,
    generationMatchPrecondition = 0
) {

    const storage = new Storage({ keyFilename: './application_default_credentials.json' });
    const bucket = storage.bucket(bucketNameSubtitles);
    var ext = path.extname(destFileName);
    const standardFileName = getStandardCloudFileName(movieId, fileId, destFileName);
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
        const bucket = storage.bucket(bucketNameSubtitles);
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

async function generateSitemapXML() {
    console.log("hello 1");
    const dySitemap = require('dynamic-sitemap');
    const list = [
        {
            loc: 'https://www.bimal.com',
            lastmod: '06-11-2020'
        },
        {
            loc: 'https://docs.bimal.com/',
            lastmod: '04-07-2020',
            images: [
                {
                    loc: 'https://docs.bimal.com/image.jpg',
                    title: 'Title example'
                }
            ]
        },
        {
            loc: 'https://www.bimal.com/package/dynamic-sitemap',
            lastmod: '06-11-2020'
        }
    ]
    const xml = dySitemap.build(list);
    console.log(xml);
    const storage = new Storage({ keyFilename: './application_default_credentials.json' });
    console.log("hello 2");
    const bucket = storage.bucket(bucketNameFiles);
    console.log("hello 3");
    const [fileExists] = await bucket.getFiles({ prefix: 'sitemap' });
    console.log("hello 4");
    if (fileExists && fileExists[0]) {
        let siteMapFile = fileExists[0];
        const writeStream = siteMapFile.createWriteStream();
        console.log("hello 5");
        writeStream.write(xml);
        console.log("hello 6");
        await writeStream.end();
        console.log("hello 7");
        console.log('Successfully wrote text to file.');
        
    }

    return;
}

module.exports = { uploadFile, getCloudFileUrlIfExists, generateSitemapXML };