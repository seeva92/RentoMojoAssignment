/**
 * Created by seeva92 on 15/12/16.
 */
const Async = require('async');
const Promise = require('bluebird');
const HashMap = require('hashmap');
const cherrio = require('cheerio');
const request = require('request');
const validUrl = require('valid-url');
const normalizeUrl = require('normalize-url');
const URL = require('url');
var csvWriter = require('csv-write-stream');
var fs = require('fs');

module.exports = function crawler(){
    "use strict";
    // Maintains the key value pair of crawled url and invalid urls
    var _this = this;
    _this.validCrawledUrls = new HashMap();
    _this.invalidUrls = new HashMap();

    //CSV Config
    _this.fields = ['url','type','title','author','description'];
    _this.writer = csvWriter({headers :  _this.fields});
    _this.writer.pipe(fs.createWriteStream('file.csv'));

    //Exclude image, video, document exclusions
    // Image: jpg, gif, tif, bmp, png
    // Audio: wav, mp3, wma
    // Video: avi, mpg, mpeg, wmv
    // Binary: bin, exe, so, dll, iso, jar, war, ear, tar, wmv, scm, cab, dmp
    _this.excludeUrlRegex = "\\.(png|jpg|gif|tif|bmp" +
        "|wav|mp3|wma|avi|mpg|mpeg|wmv|mp4" +
        "|bin|exe|so|dll|ios|jar|war|ear|tar|wmv|scm|cab|dmp)";
    //Include CSS and JS
    _this.cssUrlRegex = "\\.(css)";
    _this.jsUrlRegex = "\\.(js)";

    // Parsed urls list
    _this.parsedUrls = new HashMap();

    //Validate the urls
    _this.validateUrls = function(url){
        var str = url;
        if(str == null) return null;
        try{
            //Removing the fragments in the url
            str = normalizeUrl(str,{stripFragment: true, stripWWW: true, removeTrailingSlash: false,removeQueryParameters: ['source','redirect','gi']});
        }catch(e){
            return null;
        }

        //Restricting the domain
        if(str.indexOf(domain) === -1 || !validUrl.isUri(str)) return null;
        if(_this.invalidUrls.has(str) || str.match(_this.excludeUrlRegex)) return null;

        return str;
    }

    //Pass the cheerio loaded content
    _this.extractUrls = function (content) {
        var extractedUrls = []

        var $ = cherrio.load(content);

        //Adding Anchor tag
        $("a").each(function(){
            var curr = $(this).attr('href');
            if(curr && !_this.validCrawledUrls.has(curr))
                extractedUrls.push(curr);
        });

        //Adding Javascript
        $("script").each(function(){
            var curr = $(this).attr('src');
            if(curr && !_this.validCrawledUrls.has(curr))
                extractedUrls.push(curr);
        });

        //Adding CSS
        $("link").each(function(){
            var curr = $(this).attr('rel');
            if(curr && curr ==="stylesheet" && $(this).attr('href') && !_this.validCrawledUrls.has(curr))
                extractedUrls.push($(this).attr('href'));
        });

        return extractedUrls;
    }

    //Process the content to retrieve title,author,description
    _this.processContent = function(crawlingUrl,content){

        //Crawling url's useful content
        var urlContentObject = {};

        //Required keys of meta tag
        var keys = ['title','author','description'];
        for(var i = 0;i<keys.length;i++) urlContentObject[keys[i]] = "";
        urlContentObject['url'] = crawlingUrl;

        //Don't extract the content of CSS and Javascript
        if(crawlingUrl.match(_this.cssUrlRegex)){
            urlContentObject['type'] = "CSS";
        }
        else if(crawlingUrl.match(_this.jsUrlRegex)){
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
        if(!_this.parsedUrls.has(urlContentObject.url)){
            _this.parsedUrls.set(urlContentObject.url, urlContentObject);
            _this.writer.write(urlContentObject);
        }


    }

    // Request a url, parse and find all the urls in it
    _this.crawlUrl = function(crawlingUrl,done){
        var options = {
            url: crawlingUrl,
            method : 'GET',
            pool : false,
            maxRedirects : 5,
        };

        var callback = function (error,response,body) {
            if(!error && response.statusCode == 200){
                //Set the url to crawled urls
                _this.validCrawledUrls.set(this.href,true);
                console.log(this.href);
                //Pass the redirected url
                _this.processContent(this.href,response.body);

                //Extract Urls
                var extractedUrls= _this.extractUrls(response.body);
                _this.crawlUrls(extractedUrls);
                console.log("Concurrently Running "+_this.crawlingQueue.running());
                done();
            }else{
                //Adding to invalid urls
                _this.invalidUrls[this.href] = true;
            }
        }
        request(options,callback);
    };

    //Async queue with two concurrent workers
    _this.crawlingQueue = Async.queue(_this.crawlUrl,5);

    _this.crawlingQueue.empty = function(){
        console.log("It is empty");
    }
    _this.crawlingQueue.error = function (err,task) {
        console.log(err);
        console.log(task);
    }
    _this.crawlingQueue.drain = function(){
        console.log("Processed everything");
    }
    _this.cnt = 0;
    //Add items to Async queue
    _this.pushToQueue = function(queue,str){
        queue.push(str,function (err) {
            if(err)
                console.log(err);
            else{
                _this.cnt++;
                console.log("Length "+ _this.crawlingQueue.length() + " Processed "+_this.cnt);
            }

        });
    }

    //Add the list of url to be crawled to Queue
    var domain = "medium.com";
    _this.crawlUrls = function(strList){
        var len = strList.length;

        for(var i=0;i<len;i++){

            var str = _this.validateUrls(strList[i]);
            // console.log("VAlid url check ",validCrawledUrls[str]);
            if (str && !_this.validCrawledUrls.has(str)) {
                //Add it to Crawling queue to crawl
                _this.validCrawledUrls.set(str,true);
                _this.pushToQueue(_this.crawlingQueue,str);
            }
        }

    }
}

