import puppeteer from 'puppeteer'
import input from '@inquirer/input'
import filenamify from 'filenamify'
import path from 'path'
import { fileURLToPath } from 'url'
import { writeFile, readFile, mkdir, access } from 'fs/promises'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const sanitizeFilename = (filename: string) => filenamify(filename, { replacement: '' })

const loadCookies = async () => {
  const cookiesFilePath = path.resolve(__dirname, `./../cookies.json`)
  await access(cookiesFilePath)
  const cookiesContent = await readFile(cookiesFilePath, 'utf-8')
  const cookies = JSON.parse(cookiesContent)
  return cookies
}

const getPageInstance = async (cookies: any) => {
  const browser = await puppeteer.launch({
    defaultViewport: null,
    args: ['--start-fullscreen'],
    headless: false
  })
  const page = await browser.newPage()
  await page.setCookie(...cookies)
  return page
}

const generateBookletInfo = async (page: puppeteer.Page, bookletURL: string) => {
  await page.goto(bookletURL, {
    waitUntil: 'load'
  })
  await page.waitForSelector('.book-content .section-list a')
  let links = await page.$$eval('.book-content .section-list a', links => {
    return links.map(link => {
      const href = link.href
      const title = link.querySelector('.title-text').textContent
      return { href, title }
    })
  })

  links = links.map(item => ({
    ...item,
    title: sanitizeFilename(item.title)
  }))

  const title = await page.title()
  return { links, title: sanitizeFilename(title) }
}

const downloadPage = async (
  page: puppeteer.Page,
  links: Array<{ href: string; title: string }>,
  title: string
) => {
  const cdp = await page.target().createCDPSession()
  const outputDirPath = path.resolve(__dirname, `./../output/${title}`)
  await mkdir(outputDirPath, { recursive: true })
  for await (const [index, item] of links.entries()) {
    const { href, title } = item
    console.log(`Downloading ${title}`)
    await page.goto(href, {
      waitUntil: 'networkidle2'
    })
    await page.evaluate(() => {
      const sels = ['.book-content__header', '.recommend-box', '.book-summary']
      for (const sel of sels) {
        const ele = document.querySelector(sel)
        // @ts-ignore
        if (ele && ele.style) {
          // @ts-ignore
          ele.style.setProperty('display', 'none', 'important')
        }
      }
      // @ts-ignore
      document.querySelector('.book-content').style.marginLeft = 0
    })
    const { data } = await cdp.send('Page.captureSnapshot', { format: 'mhtml' })
    const writeFilePath = `${outputDirPath}/${index.toString().padStart(2, '0')}-${title}.mhtml`
    await writeFile(writeFilePath, data)
  }
}

const main = async () => {
  try {
    const bookletURL = await input({
      message: 'Please input booklet url.',
      validate: value => {
        const pattern = /^https:\/\/juejin\.cn\/book\/\d+(\?[\w=&-]+)?$/
        return pattern.test(value)
      }
    })
    const cookies = await loadCookies()
    const page = await getPageInstance(cookies)
    const { links, title } = await generateBookletInfo(page, bookletURL)
    await downloadPage(page, links, title)
    console.log('Finish ～')
  } catch (error) {
    console.log(error)
  } finally {
    process.exit()
  }
}

main()
