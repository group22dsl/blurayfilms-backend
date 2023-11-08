const fs = require('fs');
const { Storage } = require('@google-cloud/storage');
const axios = require('axios');
const path = require('path')
const request = require('request');

const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
require('dotenv').config();


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
    const storage = new Storage({ keyFilename: './application_default_credentials.json' });
    const bucket = storage.bucket(bucketNameFiles);
    const [fileExists] = await bucket.getFiles({ prefix: 'sitemap' });
    if (fileExists && fileExists[0]) {
        let siteMapFile = fileExists[0];
        const writeStream = siteMapFile.createWriteStream();
        writeStream.write(xml);
        await writeStream.end();
        console.log('Successfully uploaded latest sitemap');
        
    }

    return;
}

async function generateSitemap(){
    const { SitemapStream, streamToPromise } = require( 'sitemap' );
    const { Readable } = require( 'stream' );

    const links = [{ url: '/',  changefreq: 'daily', priority: 0.3  }];
    const stream = new SitemapStream( { hostname: 'https://ikmovies.com' } );

    let searchUrl = `${process.env.TMDB_BASE_URL}/movie/now_playing?api_key=${process.env.TMDB_API_KEY}&page=1`;
    let { data } = await axios.get(searchUrl);
    console.log(data);
    const numberOfPages = data.total_pages;
    data.results.forEach(movie => {
        links.push({ url: `/movie/${movie.id}/${movie.title}`,  changefreq: 'monthly', priority: 0.3  }) 
     });

    for (let i = 2; i <= numberOfPages; i++) {
        let searchUrlPage = `${process.env.TMDB_BASE_URL}/movie/now_playing?api_key=${process.env.TMDB_API_KEY}&page=${i}`;
        console.log(searchUrlPage);
        let { data: movieData } = await axios.get(searchUrlPage);
        movieData.results.forEach(movie => {
            links.push({ url: `/movie/${movie.id}/${movie.title}`,  changefreq: 'monthly', priority: 0.3  }) 
         });
    } 

    // Return a promise that resolves with your XML string
    streamToPromise(Readable.from(links).pipe(stream)).then((data) => {
        const fs = require('fs');
        const xml = data.toString();
        fs.writeFile("./sitemaps/sitemap.xml", xml, function(err) {
            if(err) {
                return console.log(err);
            }
            console.log("The sitemap was saved!");
        });
    });
}

module.exports = { uploadFile, getCloudFileUrlIfExists, generateSitemapXML,generateSitemap };