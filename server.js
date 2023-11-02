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
    const baseUrl = `${process.env.OPEN_SUBTITLE_BASE_URL}/subtitles`;

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
    const fileOperations = require('./fileops');
    let cloudFileUrl = '';
    try {
        const fileID = req.query.fileID;
        const movieID = req.query.movieID;
        cloudFileUrl = await fileOperations.getCloudFileUrlIfExists(movieID, fileID);
    } catch (error) {
        res.json({ message: null });
        return;
    }

    if(cloudFileUrl != null){
        res.json({ message: cloudFileUrl });
        return;
    }
    else {
        const params = {
            file_id: req.query.fileID
        };
    
        try {
            const url = `${process.env.OPEN_SUBTITLE_BASE_URL}/login`;
            const headers = {
                'Accept': 'application/json',
                'Api-Key': process.env.OPEN_SUBTITLE_API_KEY,
                'Content-Type': 'application/json',
                'User-Agent': 'blurayfilms v1.0',
            };
            const data = {
                "username": process.env.OPEN_SUBTITLE_USERNAME,
                "password": process.env.OPEN_SUBTITLE_PASSWORD
            };
            const loggedInResponse = await axios.post(url, data, { headers });
            if (loggedInResponse) {
                const url = `${process.env.OPEN_SUBTITLE_BASE_URL}/download`;
                const headers = {
                'Accept': 'application/json',
                'Authorization': `Bearer ${loggedInResponse.data.token}`,
                'Content-Type': 'application/json',
                'User-Agent': 'blurayfilms v1.0',
                'Api-Key': process.env.OPEN_SUBTITLE_API_KEY 
                };
                const data = {
                    "file_id": parseInt(req.query.fileID),
                };

                const downloadResponse = await axios.post(url, data, { headers });
                if (downloadResponse && downloadResponse.data) {
                    const fileDownloadUrl = await fileOperations.uploadFile(req.query.movieID, req.query.fileID, downloadResponse.data.link, downloadResponse.data.file_name);
                    res.json({ message: fileDownloadUrl });
                    return;
                } else {
                    res.json({ message: null });
                    return;
                }
            }
        } catch (error) {
            res.json({ message: `error: ${error}` });
            return;
        }
    }
});

app.get('/api/getMoviesListByType', async (req, res) => {
    try {
        if(req.query.searchType == '') {
            req.query.searchType = 'popular';
        }
        let searchUrl = `${process.env.TMDB_BASE_URL}/movie/${req.query.searchType}?api_key=${process.env.TMDB_API_KEY}&page=${req.query.page}`;
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

app.post('/api/generateSiteMap', async (req, res) => {
    const fileOperations = require('./fileops');
    try {
         fileOperations.generateSitemapXML();
         res.json({ message: "done" });
    } catch (error) {
        res.json({ message: null });
    }

    return;

});

app.listen(process.env.PORT, () => {
    console.log(`Server is running on http://localhost:${process.env.PORT}`);
});
