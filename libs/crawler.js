const phantom = require('phantom');
const $ = require('cheerio');
const uri = require('url');
const assign = require('assign-deep');
const crypto = require('crypto');
const sanitize = require('sanitize-filename');
const path = require('path');

class Crawler {
    constructor(url, depth = Crawler.InfiniteDepth, fetch = true, restrict = true, loglevel = 0, screenshot = false, width = 1600, height = 600) {
        
        // Will hold the crawled report.
        this.report = {};
        this.entryUrl = url;
        this.depth = depth;
        this.loglevel = loglevel;
        this.fetch = fetch;
        this.screenshot = screenshot;
        this.viewport = {width: width, height: height};

        // Set this to false if you want to crawl
        // all anchors. Set to true if only the anchors
        // that start with the entryUrl need to be crawled.
        this.restrict = restrict;
    }

    async crawl(userAgent = "xenu") {
        this._instance = await phantom.create();
        this._page = await this._instance.createPage();
        
        // Set phantom js settings, more information:
        // http://phantomjs.org/api/webpage/property/settings.html
        this._page.setting('userAgent', userAgent);

        await this._processURL(this.entryUrl, this.depth);

        // Quit the phantomjs process after we are done.
        await this._instance.exit();

        // Return the report data we crawled.
        return this.report;
    }

    async _processURL(url, depth) {
        // Stop processing if we have reached the maximum depth or
        // if we have already visited the url.
        if (depth <= 0 || this.report[url]) {
            return;
        }

        this._log("Opening " + url);

        // Create an empty entry in the report object
        // if there is no one for the given url.
        if ( ! this.report[url] ) {
            this.report[url] = {
                'statuscode': 0,
                'resources': []
            };
        }  

        // This is a little bit hacky. Because the PhantomJS
        // itself is running in an other node process, it is 
        // fairly difficult to communicate between the processes.
        
        // The library we use has a way to workaround to handle this
        //  issue but it looks a bit weird. We will create an `createOutObject`
        // more information: https://github.com/amir20/phantomjs-node#pageproperty
        const out = this._instance.createOutObject();
        out.resources = {};
        out.url = url;
        out.shouldFetchResources = this.fetch;
        out.loglevel = this.loglevel;

        await this._page.property("viewportSize", {width: this.viewport.width, height: this.viewport.height});

        // Listen for the onResourceRequested event. 
        await this._page.property("onResourceRequested", function(data, request, _out) {

            // Log this shit.
            if ( _out.loglevel > 1 ) {
                console.log(" Resource found: " + data.url);
            }   
            
            // Make sure we just log the resources itself
            // and not the base url.
            if (_out.url !== data.url) {
                // Save the url of the resources so we can 
                // use it in the final report.
                _out.resources[data.url] = {}

                // Check if we need to fetch the resources like css 
                // and javascript files on the page. If we don't there 
                // is a possibilty we get javascript errors on the page 
                // but the page will be crawled much faster.
                if (!_out.shouldFetchResources) {
                    request.abort();
                }
            }
        }, out);    

        const types = this._instance.createOutObject();
        types.resources = {};
        types.url = url;
        types.loglevel = this.loglevel;       

        // Listen for the onResourceRequested event. 
        await this._page.property('onResourceReceived', function(response, _out) {
            // Log this shit.
            if ( _out.loglevel > 1 ) {
                console.log(" Resource recieved: " + response.url);
            }   
            
            // Make sure we just log the resources itself
            // and not the base url.
            if (_out.url !== response.url) {
                // Save the url of the resources so we can 
                // use it in the final report.
                _out.resources[response.url] = { 
                    contentType: response.contentType,
                    contentLength: response.bodySize, 
                    statusText: response.statusText,
                    status: response.status
                }
            }
        }, types);


        // Make sure we disable the cache.
        this._page.setting('clearMemoryCaches', true);      

        // Load the page and wait for the status (fail/success).
        const status = await this._page.open(url);

        if ( this.fetch ) {
            this.report[url].resources = assign({}, 
                await out.property('resources'), 
                await types.property('resources')
            );
        }

        // Only take screenshots if enabled.
        if (this.screenshot) {
            // sleep for 2 seconds
            await new Promise(resolve => setTimeout(resolve, 2000));
            const renderpath = path.join(this.screenshot, 'screenshots', 'page_' + sanitize(url) + '.jpg');
            await this._page.render(renderpath, {format: 'jpg', quality: '100'});
            this.report[url].screenshot = 'screenshots/page_' + sanitize(url) + '.jpg';
        }        

        // Find all crawable urls in the page.
        const urls = await this._findCrawableURLsInPage(this._page);

        // Loop trough the urls we found and try to
        // process them.
        for(let i = 0; i < urls.length; i++) {
            await this._processURL(urls[i], depth-1);
        }
    }

    _log(message) {
        if (this.loglevel) {
            console.info(message);
        }
    }

    async _findCrawableURLsInPage(page) {
        let urls = await page.evaluate(function() {
            // Execute in the browser.
            return Array.prototype.slice.call(document.querySelectorAll("a"), 0)
                .filter(function(link){
                    return !! link.host;
                })
                .map(function (link) {
                    return link.protocol+"//"+link.host+link.pathname+link.search;
                });
        });

        // Remove duplicates
        urls = urls.filter((elem, pos) => {
            return urls.indexOf(elem) == pos;
        });

        if (this.restrict) {
            urls = urls.filter((url) => {
                return url.startsWith(this.entryUrl);
            });
        }

        return urls;
    }
}

Crawler.InfiniteDepth = Number.MAX_SAFE_INTEGER;

// Export the crawler to be used in require methods.
module.exports = Crawler;