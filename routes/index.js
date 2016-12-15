'use strict';
const express = require('express');
const router = express.Router();
var crawler = require('./../crawler/async-crawler.js');
var async_crawler = new crawler();


/* GET home page. */
router.get('/', function(req, res, next) {
    //Crawl Urls
    async_crawler.crawlUrls(["medium.com"]);
    res.render('index', { title: 'Express' });
});

module.exports = router;
