const async = require('async'),
      _ = require('underscore');

let getEbookCategories = callback => {
    const request = require('request'),
          cheerio = require('cheerio');

    let categories = [ ];
    request('https://www.onlinebibliotheek.nl/e-books.html', (err, res, body) => {
        const $ = cheerio.load(body)
        let elements = $('#bw-main-content > div > div > div > div > div.par_category_sections.parsys > div.linkslisting.section > div > ul').children();
        let categories = [ ];
        elements.each((index, element) => {
            if ($(element).find('a').html().trim() !== "Lijst van alle genres") {
                categories.push({
                    'name': $(element).find('a').html().trim(),
                    'url': $(element).find('a').attr('href').split('/e-books/')[1].split('.')[0]
                });
            }
        });
        callback(err, categories);
    });
}

let getEbookCategoryPage = (categoryUrl, ereaderOnly, pageNo, callback) => {
    const request = require('request'),
          cheerio = require('cheerio');

    let books = [ ];
    console.error('Fetching "' + categoryUrl + '" page no. ' + pageNo + (ereaderOnly ? ' (eReader only)' : '') + '...');
    request('https://www.onlinebibliotheek.nl/e-books/' + categoryUrl + '/alle-e-books' + (ereaderOnly ? '-ereader' : '') + '.list.' + pageNo + '.html',
        (err, res, body) => {
            const $ = cheerio.load(body)
            let elements = $('#bw-main-content > div > div > div > div > div.overview.catalogus.listoverview.parbase > ul').children();
            elements.each((index, element) => {
                books[index] = { };
                books[index].categoryUrl = categoryUrl;
                books[index].authors = $(element).find('div > p.creator.additional').html().split(',').map(x => x.trim());
                books[index].url = $(element).find('div > h3 > a').attr('href');
                books[index].title = $(element).find('div > h3 > a').html().trim();
                books[index].synopsis = $(element).find('div > p.maintext.separate').html().trim();
            });
            callback(err, books);
        });
}

let getEbookCategory = (categoryUrl, ereaderOnly, callback) => {
    const request = require('request'),
          cheerio = require('cheerio');

    request('https://www.onlinebibliotheek.nl/e-books/' + categoryUrl + '/alle-e-books' + (ereaderOnly ? '-ereader' : '') + '.list.html',
        (err, res, body) => {
            const $ = cheerio.load(body)
            let noOfPages = $('#bw-main-content > div > div > div > div > div.overview.catalogus.listoverview.parbase > div.pagenav > div > ol > li:last-child > a').html();
            noOfPages = _.isNull(noOfPages) ? 0 : parseInt(noOfPages);
            console.error('Fetching "' + categoryUrl + '" (' + noOfPages + ' pages)...');
            async.mapSeries(_.range(1, noOfPages + 1), (pageNo, callback) => {
                getEbookCategoryPage(categoryUrl, ereaderOnly, pageNo, callback);
            }, (err, results) => {
                callback(err, _.flatten(results, true));
            });
        });
}

let getEbooks = (ereaderOnly, callback) => {
    getEbookCategories((err, categories) => {
        async.mapSeries(categories, (category, callback) => {
            console.error('Fetching "' + category.name + ' (' + category.url + ')...');
            getEbookCategory(category.url, ereaderOnly, callback);
        }, (err, results) => {
            callback(err, _.flatten(results, true));
        });
    });
}

getEbooks(true, (err, results) => {
    console.log(JSON.stringify(results));
});
