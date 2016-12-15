'use strict';
var crawler = require('./async-crawler.js');
var async_crawler = new crawler();

async_crawler.crawlUrls(["medium.com"]);

