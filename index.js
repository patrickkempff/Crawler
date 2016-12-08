const fs = require('fs');
const Crawler = require('./libs/crawler.js');

// Let the crawler know which website we want to crawl and
// at which depth it needs to stop.
const crawler = new Crawler("http://www.lindemans.com", Crawler.InfiniteDepth);

// Wait for the crawler to finish
crawler.crawl().then((report) => {
    console.log('Writing report. Please wait...');

    // Write the report to disk.
    fs.writeFile('report/report.json', JSON.stringify(report, null, 4), function(){
        console.log('Done!');
    });
});

