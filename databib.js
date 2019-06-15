const async = require('async'),
      _ = require('underscore'),
      request = require('request'),
      $ = require('cheerio');

let cheerioMe = (url, jsSelector, callback) => {
    request(url, (err, res, body) => callback(err, err ? null : $.load(body)(jsSelector)));
}

let getEbookCategories = callback => {
    cheerioMe(
        'https://www.onlinebibliotheek.nl/e-books.html',
        '#bw-main-content > div > div > div > div > div.par_category_sections.parsys > div.linkslisting.section > div > ul',
        (err, elements) => {
            let categories = [ ];
            elements.children().each((index, element) => {
                if ($(element).find('a').html().trim() !== "Lijst van alle genres") categories.push({
                    'name': $(element).find('a').html().trim(),
                    'url': $(element).find('a').attr('href').split('/e-books/')[1].split('.')[0]
                });
            });
            callback(err, categories);
        });
}

let getEbookCategoryPage = (categoryUrl, ereaderOnly, pageNo, callback) => {
    console.error('Fetching "' + categoryUrl + '" page no. ' + pageNo + (ereaderOnly ? ' (eReader only)' : '') + '...');
    cheerioMe(
        'https://www.onlinebibliotheek.nl/e-books/' + categoryUrl + '/alle-e-books' + (ereaderOnly ? '-ereader' : '') + '.list.' + pageNo + '.html',
        '#bw-main-content > div > div > div > div > div.overview.catalogus.listoverview.parbase > ul',
        (err, elements) => {
            let books = [ ];
            elements.children().each((index, element) => {
                books[index] = { };
                books[index].categoryUrl = categoryUrl;
                books[index].authors = $(element).find('div > p.creator.additional').html();
                // the authors may not be specified!
                books[index].authors = !_.isNull(books[index].authors) ? books[index].authors.split(',').map(x => x.trim()) : [ ];
                books[index].url = $(element).find('div > h3 > a').attr('href');
                books[index].title = $(element).find('div > h3 > a').html().trim();
                books[index].synopsis = $(element).find('div > p.maintext.separate').html().trim();
            });
            callback(err, books);
        });
}

let getEbookCategory = (categoryUrl, ereaderOnly, callback) => {
    cheerioMe(
        'https://www.onlinebibliotheek.nl/e-books/' + categoryUrl + '/alle-e-books' + (ereaderOnly ? '-ereader' : '') + '.list.html',
        '#bw-main-content > div > div > div > div > div.overview.catalogus.listoverview.parbase > div.pagenav > div > ol > li:last-child > a',
        (err, noOfPages) => {
            noOfPages = noOfPages.html();
            // there may be no pages, particularly if ebooks only are requested
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
            getEbookCategory(category.url, ereaderOnly, callback);
        }, (err, results) => {
            callback(err, _.flatten(results, true));
        });
    });
}

let getAudiobooks = callback => {
    cheerioMe(
        'https://www.onlinebibliotheek.nl/luisterbieb/titels-in-de-luisterbieb.html',
        '#bw-main-content > div > div > div > div.main-column > div > div.maintext.parsys',
        (err, categories) => {
            let books = [ ],
                firstLevelCategory = '',
                secondLevelCategory = '';
            categories.children().each((index, element) => {
                switch ($(element).attr('class')) {
                    case 'title text parbase section':
                        firstLevelCategory = $(element).find('h3').html().trim();
                        // console.error('Found 1st level: ' + firstLevelCategory);
                        break;
                    case 'faq parbase section':
                        secondLevelCategory = $(element).find('h4').html().trim();
                        // console.error(secondLevelCategory);
                        books = books.concat($(element).find('p').html().split('<br>').map(line => line.replace('\n', '').trim()).filter(line => line !== '').filter(line => line.indexOf('|') !== -1).map(line => {
                            return {
                                'categoryFirstLevel': firstLevelCategory,
                                'categorySecondLevel': secondLevelCategory,
                                'authors': [ line.split('|')[0].trim() ],
                                'title': line.split('|')[1].trim()
                            };
                        }));
                        break;
                }
            });
            callback(err, books);
        }
    );
}

/*
getEbooks(true, (err, results) => {
    console.log(JSON.stringify(results));
});
*/

getAudiobooks((err, books) => {
    console.log(JSON.stringify(books));
})
