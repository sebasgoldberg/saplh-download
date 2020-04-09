#!/usr/bin/env node
const rp = require("request-promise");
const fs = require('fs');
const PDFDocument = require('pdfkit');
const SVGtoPDF = require("svg-to-pdfkit");
const sleep = require("system-sleep");
var convert = require('xml-js');

const config = require("./config");

const HEADERS = {
    "Host": "saplearninghub.plateau.com",
    "Connection": "keep-alive",
    "Cache-Control": "max-age=0",
    "Upgrade-Insecure-Requests": "1",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.163 Safari/537.36",
    "Sec-Fetch-Dest": "document",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-User": "?1",
    "Accept-Encoding": "gzip, deflate, br",
    "Accept-Language": "es,pt-BR;q=0.9,pt;q=0.8,en;q=0.7,de;q=0.6,en-US;q=0.5,he;q=0.4",
    "Cookie": config.COOKIE_SESSION,
    // "If-None-Match": '"7496-57fb9dcd94b6b"',
    // "If-Modified-Since": "Fri, 18 Jan 2019 11:32:14 GMT",
};

async function getSVGPage(pageNumber){
    response = await rp({
        url: `${config.E_BOOK_BASE_URL}/xml/topic${pageNumber.toString()}.svg`,
        headers: HEADERS,
        encoding: null,
        resolveWithFullResponse: true,
        gzip: true,
    });
    return response.body.toString();
}

async function getFont(fontName){
    let fontname = fontName.replace("'","").replace("'","")
    response = await rp({
        url: `${config.E_BOOK_BASE_URL}/fonts/${fontname.replace(' ','-')}.woff`,
        headers: HEADERS,
        encoding: null,
        resolveWithFullResponse: true,
        // gzip: true,
    });
    return response.body;
}

let FONTS = {}

function fontCallback(...args){

    let font = args[0];

    if (font in FONTS){
        return FONTS[font];
    }

    FONTS[font] = undefined;

    let requestFinished = false;

    getFont(font)
        .then( data => FONTS[font]=data )
        .catch( error => console.error(`Font ${font} not found on SAP Learning HUB.`) )
        .finally( () => requestFinished = true );

    while (!requestFinished){
        sleep(100);
    }

    return FONTS[font];
    
}

class BookmarkManager{

    constructor(doc){
        this.doc = doc;

        this.BOOKMARKS = {
        };

        this.BOOKMARKS_XML_HIERARCHY = {
            'unit': 'lesson',
            'lesson': 'bookmark',
        }
        this.currentUnit = undefined;
        this.currentLesson = undefined;
    }

    async  _getXMLBookmarks(){
        return await rp({
            url: `${config.E_BOOK_BASE_URL}/xml/manifest.xml`,
            headers: HEADERS,
            gzip: true,
        });
    }
    
    _addBookmarksRecursive(domItem, childNameToBookmark, type=undefined){
    
        if (domItem._attributes && domItem._attributes.page && domItem['bookmark-title'] && type){
            let page = Number(domItem._attributes.page);
            let bookmark = { title: domItem['bookmark-title']._text, type: type };
            page in this.BOOKMARKS ?
                this.BOOKMARKS[page].push(bookmark) :
                this.BOOKMARKS[page] = [bookmark];
        }

        let childsToBookmark = []
    
        if (childNameToBookmark && childNameToBookmark in domItem)
            childsToBookmark = domItem[childNameToBookmark];

        if (typeof childsToBookmark[Symbol.iterator] !== 'function')
            childsToBookmark = [childsToBookmark];
            
        for (let child of childsToBookmark){
            this._addBookmarksRecursive(child, this.BOOKMARKS_XML_HIERARCHY[childNameToBookmark], childNameToBookmark)
        }
    }
    
    async initializeBookmarkDefinition(){
    
        // try {
    
            let xmlContent = await this._getXMLBookmarks();
    
            var bookmarkDefinition = JSON.parse(convert.xml2json(xmlContent, {compact: true, spaces: 4}));
    
            let course = bookmarkDefinition.course;
            let bookmarkTree = course['bookmark-tree'];
    
            this._addBookmarksRecursive(bookmarkTree, 'unit');
        
        // } catch (error) {
        //     console.error(`Error trying to obtain the bookmarks: ${error}`);
        // }
    
    }

    addBookmarks(page){
        if (!(page in this.BOOKMARKS))
            return;
        for (let bookmark of this.BOOKMARKS[page]){
            if (bookmark.type == 'unit')
                this.currentUnit = this.doc.outline.addItem(bookmark.title);
            else if (bookmark.type == 'lesson')
                this.currentLesson = this.currentUnit.addItem(bookmark.title);
            else
                this.currentLesson.addItem(bookmark.title);
        }
    }

}

async function downloadEBook(from, to){

    const doc = new PDFDocument;
    let firstPage = true;

    let bookmarkManager = new BookmarkManager(doc);

    await bookmarkManager.initializeBookmarkDefinition();

    for (let i=from; i<=to; i++){

        let svgContent;

        try{
            svgContent = await getSVGPage(i);
        }catch(e){
            console.error(`Error when trying to retrieve page ${i}. Finalizing process.`);
            break;
        }

        firstPage ? firstPage = false : doc.addPage();

        bookmarkManager.addBookmarks(i);
        
        SVGtoPDF(doc, svgContent, 0, 0, { fontCallback: fontCallback });

        console.info(`Page ${i} sucessfuly added to the e-book.`)

    }

    doc.pipe(fs.createWriteStream(`${config.E_BOOK_NAME}.pdf`));

    doc.end();

}

downloadEBook(config.FROM_PAGE, config.TO_PAGE);