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

        console.log('ddddddddd', moviePageLink);

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

app.get('/api/gePopularMovies', async (req, res) => {
    try {
        const searchUrl = `${process.env.TMDB_BASE_URL}/discover/movie?include_adult=false&include_video=false&language=en-US&page=1&sort_by=popularity.desc&api_key=${process.env.TMDB_API_KEY}`;
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

app.listen(process.env.PORT, () => {
    console.log(`Server is running on http://localhost:${process.env.PORT}`);
});
