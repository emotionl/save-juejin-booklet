import puppeteer from 'puppeteer'
import path from 'path'
import { writeFile } from 'fs/promises'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const saveCookies = async () => {
  try {
    const browser = await puppeteer.launch({
      defaultViewport: null,
      args: ['--start-fullscreen'],
      headless: false
    })
    const page = await browser.newPage()
    await page.goto('https://juejin.cn/', {
      waitUntil: 'networkidle2'
    })
    await page.waitForSelector('.avatar-wrapper', {
      timeout: 60000
    })
    const cookies = await page.cookies()
    const cookiesFilePath = path.resolve(__dirname, `./../cookies.json`)
    await writeFile(cookiesFilePath, JSON.stringify(cookies))
    console.log('🚀 Save cookies success ~')
  } catch (error) {
    console.error(error)
  } finally {
    process.exit()
  }
}

saveCookies()
