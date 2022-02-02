const axios = require('axios')
const cheerio = require('cheerio')
const ObjectsToCsv = require('objects-to-csv')

const BASE_URL = 'https://stackoverflow.com'
const HOME_URL = `${BASE_URL}/questions?tab=newest&page=`
const visited = new Set()
const all_questions = new Object()
const currently_timeout = false

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const get_page_count = $ => {
	links = [...new Set( 
		$('a.s-pagination--item.js-pagination-item')
			.map((_, a) => $(a).text())
			.toArray()
	),]
    page_count = links[links.length - 2]
    console.log(page_count, links)
    return page_count
}

const get_question_links = $ => [
    ...new Set(
        $('a.question-hyperlink')
            .map((_, a) => BASE_URL+$(a).attr('href'))
            .toArray()
    ),
]


const get_html = async (url) => {
    const { data } = await axios.get(url); 
	return data; 
}


const extract_data = $ => {
        answers_count = $("#answers-header > div > div.flex--item.fl1 > h2").attr('data-answercount')
        if(answers_count == undefined) answers_count = 0
        upvote_count = $('div.js-vote-count').map((_,div) => $(div).attr('data-value')).toArray()[0]
        if(upvote_count == undefined) upvote_count = 0
        return {
            upvote_count,
            answers_count 
        }
    }


const crawl = async (url) => {
    visited.add(url)
    console.log("Crawling " + url)
    try{
        const html = await get_html(url)
        const $ = cheerio.load(html)
        var info = extract_data($)
        info = {...info, question_link: url, question_encounters: 1}
        const question_links = get_question_links($)
        question_links.filter(link => !visited.has(link))
            .forEach(link => links_queue.enqueue(crawlTask, link))

        if(url in all_questions){
            all_questions[url] = {...all_questions[url], question_encounters: all_questions[url].question_encounters + 1}
        }
        else all_questions[url] = {...info}
    }
    catch(err){
        console.log("initiating 15 sec timeout")
        currently_timeout = true
        visited.delete(url)
        setTimeout(() => {
            currently_timeout = false
        }, 15000)
    }
}

const queue = (concurrency = 5) => {
    let crawler_count = 0
    const tasks = []

    return {
        enqueue: async(task, ...params) => {
            tasks.push({ task, params })
            if(crawler_count >= concurrency) {
                return
            }

            if(currently_timeout){
                console.log("timeout")
                return
            }

            crawler_count++
            while(tasks.length){
                const { task, params } = tasks.shift()
                await task(...params)
            }
            crawler_count--
        },
        isEmpty: () => tasks.length === 0,
    }
}

const crawlTask = async (url) => {
    if(visited.size >= 500) {
        return
    }
    
    if(visited.has(url))
        return
    try{
        await crawl(url)
    }
    catch(err){
        console.log("error in crawlTask")
    }
}


const links_queue = queue()

const pages = 50

const addPageQuestiontoQueue = async (url) => {
    const html = await get_html(url)
    const $html = cheerio.load(html)
    get_question_links($html).forEach(link => links_queue.enqueue(crawlTask, link))
}
for(var i = 1; i <= 1; i++) {
    console.log(`crawling page ${i}`)
    try{
        addPageQuestiontoQueue(HOME_URL+i)
    }catch(err){
        console.log("error in addPageQuestiontoQueue")
    }
}


const objtocsv = async () => {
    question_arr = []
    for(var key in all_questions){
        question_arr.push(all_questions[key])
    }
    console.log("creating csv")
    const csv = new ObjectsToCsv(question_arr);   
    await csv.toDisk('./test.csv');
  }

async function exitHandler(options, exitCode) {
    console.log("exit called")

    await objtocsv()
    
    if (options.exit) process.exit();
}

process.on('exit', exitHandler.bind(null,{exit:true}));
process.on('SIGINT', exitHandler.bind(null, {exit:true}));
process.on('SIGUSR1', exitHandler.bind(null, {exit:true}));
process.on('SIGUSR2', exitHandler.bind(null, {exit:true}));
process.on('uncaughtException', exitHandler.bind(null, {exit:true}));
