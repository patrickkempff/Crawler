#!/usr/bin/env node --harmony

const Crawler = require('./libs/crawler.js');
const program = require('commander');
const mkdirp = require('mkdirp');
const fs = require('fs');
const path = require('path');


program
  .version('0.0.1')
  .arguments('<url>')
  .action(function (url) {
      // TODO url validaiton.
     urlValue = url;
  })
  .option('-s, --screenshots', 'enable taking of screenshots')
  .option('-r, --resources', 'enable fetching of resources', true)
  .option('-e, --restrict', 'restrict following of link to the baseurl only', true)
  .option('-o, --output_dir [file]', 'Folder path where the report will be stored', './reports')
  .option('-u, --useragent [ua]', 'The useragent that will be used during crawling', 'xenu')
  .option('-w, --viewport-width [width]', 'The width in pixels used to size the viewport', 1600)
  .option('-h, --viewport-height [height]', 'The height in pixels used to size the viewport', 600)
  .option('-d, --max-depth <i>', 'Max page depth to be crawled', parseFloat, 3)//Crawler.InfiniteDepth)
  .option('-v, --verbose', 'A value that can be increased', (v, total) => total + 1, 0)

program.parse(process.argv);

// Check if a url is given.
if (typeof urlValue === 'undefined') {
   console.error('no url given!');
   process.exit(1);
}

program.verbose = program.verbose || 0;
program.resources = program.resources || false;
program.screenshots = program.screenshots || false;
program.url = program.url || urlValue;



// Let the crawler know which website we want to crawl and
// at which depth it needs to stop.
const crawler = new Crawler(
    program.url, 
    program.maxDepth, 
    program.resources,
    program.restrict,
    program.verbose,
    program.screenshots && program.output_dir,
    program.viewportWidth,
    program.viewportHeight
);

// Wait for the crawler to finish
crawler.crawl(program.useragent).then((report) => {
    if (program.verbose > 0) {
        console.log('Writing report to %s. Please wait...', path.join(program.output_dir, 'report.json'));
    }

    // Create the output dir is it not exists already.
    mkdirp(program.output_dir, (err) => {
        if (err) {
            return console.error(err);
        }

        // Write the report to disk.
        fs.writeFile(path.join(program.output_dir, 'report.json'), JSON.stringify(report, null, 4), function(){
            if (program.verbose > 0) {
                console.log('Done!');
            }
        });        
    });
});
