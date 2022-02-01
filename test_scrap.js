const axios = require('axios')
const cheerio = require('cheerio')
const ObjectsToCsv = require('objects-to-csv')

const BASE_URL = 'https://stackoverflow.com'
const HOME_URL = `${BASE_URL}/questions?tab=newest&page=`
const visited = new Set()
const all_questions = {}
const currently_timeout = false

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const get_page_count = $ => {
	links = [...new Set( 
		$('a.s-pagination--item.js-pagination-item') // Select pagination links 
			.map((_, a) => $(a).text()) // Extract the href (url) from each link 
			.toArray() // Convert cheerio object to array 
	),]
    page_count = links[links.length - 2]
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
        return {
        upvote_count: $('div.js-vote-count').map((_,div) => $(div).attr('data-value')).toArray()[0],
        answers_count: $("#answers-header > div > div.flex--item.fl1 > h2").attr('data-answercount')
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
        console.log(err, "initiating 10 sec timeout")
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
                console.log("wait bruh")
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
        console.log("Have done it enough")
        return
    }
    
    if(visited.has(url))
        return
    try{
        await crawl(url)
    }
    catch(err){
        console.log(err)
    }
}


const links_queue = queue()
// const first_page = get_html(HOME_URL + 1)
// const $first = cheerio.load(first_page)
// const pages = min(get_page_count($first), 10000)

// for(var i = 1; i <= 10; i++) {
//     console.log("crawling page " + i)
//     links_queue.enqueue(crawlTask, HOME_URL+1)
// }
links_queue.enqueue(crawlTask, 'https://stackoverflow.com/questions/14031763/doing-a-cleanup-action-just-before-node-js-exits')

//         const $ = cheerio.load(data)
//         const page_count = get_page_count($)
//         console.log(page_count)
// })

async function exitHandler(options, exitCode) {
    console.log("exit called")
    const objtocsv = async () => {
        console.log("starting to write csv")
        const csv = new ObjectsToCsv(all_questions.values());
       
        // Save to file:
        await csv.toDisk('./test.csv');
       
        // Return the CSV file as string:
        // console.log(await csv.toString());
      }
    await objtocsv()
    if (options.cleanup) console.log('clean');
    if (exitCode || exitCode === 0) console.log(exitCode, 'clean142134234');
    if (options.exit) process.exit();
}

//do something when app is closing
process.on('exit', exitHandler.bind(null,{cleanup:true}));

//catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, {exit:true}));

// catches "kill pid" (for example: nodemon restart)
process.on('SIGUSR1', exitHandler.bind(null, {exit:true}));
process.on('SIGUSR2', exitHandler.bind(null, {exit:true}));

//catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, {exit:true}));