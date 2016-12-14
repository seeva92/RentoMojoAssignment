'use strict';
const express = require('express');
const router = express.Router();
const Async = require('async');
const Promise = require('bluebird');
const HashMap = require('hashmap');
const cherrio = require('cheerio');
const request = require('request');
const validUrl = require('valid-url');
const normalizeUrl = require('normalize-url');
const URL = require('url');

// Maintains the key value pair of crawled url and invalid urls
var validCrawledUrls = [];
var invalidUrls = new HashMap();

//Exclude image, video, document exclusions
// Image: jpg, gif, tif, bmp, png
// Audio: wav, mp3, wma
// Video: avi, mpg, mpeg, wmv
// Binary: bin, exe, so, dll, iso, jar, war, ear, tar, wmv, scm, cab, dmp
const excludeUrlRegex = "\\.(png|jpg|gif|tif|bmp" +
                        "|wav|mp3|wma|avi|mpg|mpeg|wmv|mp4" +
                        "|bin|exe|so|dll|ios|jar|war|ear|tar|wmv|scm|cab|dmp)";
//Include CSS and JS
const cssUrlRegex = "\\.(css)";
const jsUrlRegex = "\\.(js)";

var isCrawlingDone = false;

// Parsed urls list
var parsedUrls = [];

//Pass the cheerio loaded content
var extractUrls = function (content) {
    var extractedUrls = []

    var $ = cherrio.load(content);

    //Adding Anchor tag
    $("a").each(function(){
        var curr = $(this).attr('href');
        if(curr && !validCrawledUrls[curr])
            extractedUrls.push(curr);
    });

    //Adding Javascript
    $("script").each(function(){
        var curr = $(this).attr('src');
        if(curr && !validCrawledUrls[curr])
            extractedUrls.push(curr);
    });

    //Adding CSS
    $("link").each(function(){
        var curr = $(this).attr('rel');
        if(curr && curr ==="stylesheet" && $(this).attr('href') && !validCrawledUrls[curr])
            extractedUrls.push($(this).attr('href'));
    });

    return extractedUrls;
}

//Process the content to retrieve title,author,description
var processContent = function(crawlingUrl,content){



    //Crawling url's useful content
    var urlContentObject = {};

    //Required keys of meta tag
    var keys = ['title','author','description'];
    for(var i = 0;i<keys.length;i++) urlContentObject[keys[i]] = "";
    urlContentObject['url'] = crawlingUrl;


    //Don't extract the content of CSS and Javascript
    if(crawlingUrl.match(cssUrlRegex)){
        urlContentObject['type'] = "CSS";
    }
    else if(crawlingUrl.match(jsUrlRegex)){
        urlContentObject['type'] = "Javascript";
    }
    else{
        urlContentObject['type'] = "Web Page";
        //Loading the content to Cheerio
        var $ = cherrio.load(content);

        //Iterate over all the meta tags to extract the content
        $("head > meta").each(function(){
            var currentMetaTag = $(this);
            for(var i=0;i<keys.length;i++){
                if(currentMetaTag.attr('name') == keys[i]){
                    urlContentObject[keys[i]] = currentMetaTag.attr('content');
                }
            }
        });
    }

    //Entire url and its processed content
    parsedUrls.push(urlContentObject);

}

// Request a url, parse and find all the urls in it
var crawlUrl = function(crawlingUrl,done){
    var options = {
        url: crawlingUrl,
        method : 'GET',
        pool : false,
        maxRedirects : 5,
    };

    var callback = function (error,response,body) {
        if(!error && response.statusCode == 200){
            //Set the url to crawled urls
            validCrawledUrls[this.href]=true;
            console.log(this.href);
            //Pass the redirected url
            processContent(this.href,response.body);

            //Extract Urls
            var extractedUrls= extractUrls(response.body);
            crawlUrls(extractedUrls);
        }else{
            //Adding to invalid urls
            invalidUrls[this.href] = true;
        }
        done();
    }
    request(options,callback);
};

//Async queue with two concurrent workers
var crawlingQueue = Async.queue(crawlUrl,5);

crawlingQueue.empty = function(){
    console.log("It is empty");
}
crawlingQueue.error = function (err,task) {
    console.log(err);
    console.log(task);
}
crawlingQueue.drain = function(){
    console.log("Processed everything");
}
var cnt = 0;
//Add items to Async queue
var pushToQueue = function(queue,str){
    queue.push(str,function (err) {
        if(err)
            console.log(err);
        else{
            cnt++;
            console.log("Length "+ crawlingQueue.length() + "Processed "+cnt);
        }

    });
}

//Add the list of url to be crawled to Queue
var domain = "medium.com";
var crawlUrls = function(strList){
    var len = strList.length;

    for(var i=0;i<len;i++){
        var str = strList[i];
        if(str == null || !validUrl.isUri((str))) continue;

        //Removing the fragments in the url
        str = normalizeUrl(strList[i],{stripFragment: true, stripWWW: true, removeTrailingSlash: false,removeQueryParameters: ['source','redirect']});
        if(!str) continue;

        //Restricting the domain
        if(str.indexOf(domain) === -1) continue;

        //Failed urls
        if(invalidUrls.has((str)) || str.match(excludeUrlRegex) || !(validUrl.isUri(str))) continue;

        // console.log("VAlid url check ",validCrawledUrls[str]);
        if (!validCrawledUrls[str]) {
            //Add it to Crawling queue to crawl
            pushToQueue(crawlingQueue,str);
        }
    }

}


/* GET home page. */
router.get('/', function(req, res, next) {

    // while(!isCrawlingDone){
    //
    // }
    // async.each
    crawlUrls(["medium.com"]);

    // validCrawledUrls.set("https://medium.com",true);
    // if(!validCrawledUrls.has("https://medium.com")) console.log("wow");
    res.render('index', { title: 'Express' });
});

module.exports = router;
