const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();
app.use(cors());
require('dotenv').config();

const cheerio = require('cheerio');

app.get('/api/getTorrentLink', async (req, res) => {
    try {
        const searchURL = `${process.env.TORRENT_BASE_URL}/search/${encodeURIComponent(req.query.movieName)}/1/`;
        const { data: searchData } = await axios.get(searchURL);
        const $ = cheerio.load(searchData);

        const moviePageLink = $('td.name a:nth-child(2)').attr('href');

        if (!moviePageLink) {
            res.json({ message: null });
            return;
        }

        const movieURL =  `${process.env.TORRENT_BASE_URL+moviePageLink}`;
        const { data: movieData } = await axios.get(movieURL);
        const $$ = cheerio.load(movieData);
        
        const magnetLink = $$('a[href^="magnet:?xt="]').attr('href');

        if (magnetLink) {
            res.json({ message: magnetLink });
            return;
        } else {
            res.json({ message: null });
            return;
        }

    } catch (error) {
        res.json({ message: null });
        return;
    }
});

app.get('/api/getSubtitles', async (req, res) => {
    const baseUrl = process.env.OPEN_SUBTITLE_BASE_URL;

    const params = {
        tmdb_id: req.query.movieId
    };

    try {
        const response = await axios.get(baseUrl, {
            params: params,
            headers: {
                'Api-Key': process.env.OPEN_SUBTITLE_API_KEY,
                'User-Agent': 'blurayfilms v1.0'
            }
        });
        if (response.data.data) {
            res.json({ message: response.data.data });
            return;
        } else {
            res.json({ message: null });
            return;
        }
    } catch (error) {
        res.json({ message: null });
        return;
    }
});

app.get('/api/getSubtitleDownloadLinkForFile', async (req, res) => {

    const baseUrl = process.env.OPEN_SUBTITLE_DOWNLOAD_BASE_URL;
    const fileOperations = require('./fileops');

    const fileID = req.query.fileID;
    const cloudFileUrl = await fileOperations.getCloudFileUrlIfExists(fileID);
    if(cloudFileUrl != null){
        console.log("hitting if")
        return cloudFileUrl;
    }
    else {
        console.log("hitting else")
        console.log(fileID)
        //file not found in google cloud storage
        const params = {
            file_id: fileID
        };
    
        try {
            // const response = await axios.post('https://api.opensubtitles.com/api/v1/download',params,{
            //     headers: {
            //         'Api-Key': process.env.OPEN_SUBTITLE_API_KEY,
            //         'User-Agent': 'blurayfilms v1.0'
            //     }
            // });
            
            //Comment out the below constant and rename all the response_data_data to response.data.data. Also uncomment the above axios post call
            const response_data_data = {
                "link": "https://www.opensubtitles.com/download/D3FB6A57F3C7BF5A427C1B4C9615732FE1A407D87643BD4FAD4B66E962727AD5FC1154C0819A220180FFD3574D6C80F7E0736499E33F056B2B2B4E5834C02A33DA7C3C169A772594C4879A4ADC5CEBF9A75D3A1A8AFEAA8579CABAE0C5969A8008016A3C6C6E043F7BF4EB461F14AFB94BAB41DA60E8EC9E585A2A60ADD89E76AC98F9002076C9C7C46B34AF68A5B3315DB9AF33E91542559BBADD04584C4CF251670139CA6C55379FF4C79FC789C0CEFA42612F40C93929C67A1BF012952E3882AD5B9467CD7F2D304060BA2055480374B25D444A643FC1F96B55A63FEF18AFF1C9CF7DDBBC9F9E93EA007BD93053C2519B6D1C8E1B5B4DF2B7A5F01CEA561477A8C7A9AC5327D7FC2DB541F0A15F2F4A225FAAE4256BF289AC9B9095AFA3E4B3B7B48CA007AA20/subfile/Iron.Man.3.2013.720p.BluRay.x264-SPARKS.srt",
                "file_name": "Iron.Man.3.2013.720p.BluRay.x264-SPARKS.srt",
                "requests": 2,
                "remaining": 98,
                "message": "Your quota will be renewed in 13 hours and 17 minutes (2023-10-20 23:59:59 UTC) ts=1697798539 ",
                "reset_time": "13 hours and 17 minutes",
                "reset_time_utc": "2023-10-20T23:59:59.000Z",
                "uk": "app_64110",
                "uid": 2,
                "ts": 1697798539
            };
            if (response_data_data) {
                const fileDownloadUrl = fileOperations.uploadFile(fileID, response_data_data.link,response_data_data.file_name);
                res.json({ message: fileDownloadUrl });
                return;
            } else {
                res.json({ message: null });
                return;
            }
        } catch (error) {
            console.log(error);
            res.json({ message: null });
            return;
        }
    }
});

app.get('/api/getMoviesListByType', async (req, res) => {
    try {
        if(req.query.searchType == '') {
            req.query.searchType = 'popular';
        }
        let searchUrl = `${process.env.TMDB_BASE_URL}/movie/${req.query.searchType}?api_key=${process.env.TMDB_API_KEY}`;
        
        const { data } = await axios.get(searchUrl);
        if (data){
            res.json({ message: data });
            return;
        } else {
            res.json({ message: "null" });
            return;
        }
    } catch (error) {
        res.json({ message: error });
        return;
    }
});

app.get('/api/getSingleMovieData', async (req, res) => {
    try {
        const searchUrl = `${process.env.TMDB_BASE_URL}/movie/${req.query.movieId}?api_key=${process.env.TMDB_API_KEY}`;
        const { data } = await axios.get(searchUrl);
        if (data){
            res.json({ message: data });
            return;
        } else {
            res.json({ message: "null" });
            return;
        }
    } catch (error) {
        res.json({ message: error });
        return;
    }
});

app.get('/api/getMovieTrailer', async (req, res) => {
    const endpoint = `${process.env.TMDB_BASE_URL}/movie/${req.query.movieId}/videos?api_key=${process.env.TMDB_API_KEY}`;
            
    try {
        const response = await axios.get(endpoint);
        const videos = response.data.results;

        const trailer = videos.find(video => video.type === 'Trailer');

        if (trailer && trailer.site === 'YouTube') {
            res.json({ message: trailer.key });
            return;
        } else {
            res.json({ message: null });
            return;
        }
    } catch (error) {
        res.json({ message: null });
        return;
    }
});

app.get('/api/getTorrentsForMovie', async (req, res) => {
    const endpoint = `${process.env.YTS_BASE_URL}/movie_details.json?imdb_id=${req.query.movieId}`;
    try {
        const response = await axios.get(endpoint);
        if(response && response.data && response.data.data.movie) {
            res.json({ message: response.data.data.movie.torrents });
            return;
        } else {
            res.json({ message:null });
            return;
        }
    } catch (error) {
        res.json({ message: null });
        return;
    }
});

app.get('/api/searchMovieByKey', async (req, res) => {
    const endpoint = `${process.env.TMDB_BASE_URL}/search/movie?api_key=${process.env.TMDB_API_KEY}&query=${req.query.key}`;
    try {
        const response = await axios.get(endpoint);
        if(response && response.data && response.data.results) {
            res.json({ message: response.data.results });
            return;
        } else {
            res.json({ message:null });
            return;
        }
    } catch (error) {
        res.json({ message: null });
        return;
    }
});

app.get('/api/getAvailableRegions', async (req, res) => {
    const endpoint = `${process.env.TMDB_BASE_URL}/watch/providers/regions?api_key=${process.env.TMDB_API_KEY}`;
    try {
        const response = await axios.get(endpoint);
        if(response && response.data && response.data.results) {
            res.json({ message: response.data.results });
            return;
        } else {
            res.json({ message:null });
            return;
        }
    } catch (error) {
        res.json({ message: null });
        return;
    }
});

app.get('/api/getMovieWatchProviders', async (req, res) => {
    const endpoint = `${process.env.TMDB_BASE_URL}/movie/${req.query.movieId}/watch/providers?api_key=${process.env.TMDB_API_KEY}`;
    try {
        const response = await axios.get(endpoint);
        if(response && response.data && response.data.results) {
            res.json({ message: response.data.results });
            return;
        } else {
            res.json({ message:null });
            return;
        }
    } catch (error) {
        res.json({ message: null });
        return;
    }
});

app.listen(process.env.PORT, () => {
    console.log(`Server is running on http://localhost:${process.env.PORT}`);
});
