import fs from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'

import ffmpeg from 'fluent-ffmpeg'
import qs from 'qs'
import sharp from 'sharp'
import { MessageMedia } from 'whatsapp-web.js'

import { imgproxy } from '../config'
import { GiphySearch } from '../types/Giphy'
import { TenorSearch } from '../types/Tenor'


export const paramSerializer = (p: TenorSearch | GiphySearch) => {
  return qs.stringify(p, { arrayFormat: 'brackets' })
}

// Random true based on 1:odds
export const oneChanceIn = (odds: number) => {
  return Math.floor(Math.random() * odds) === 0
}

export const proxyImage = async (url: string) => {
  // Do nothing if imgproxy is not set
  if (!imgproxy) return await MessageMedia.fromUrl(url, { unsafeMime: true })
  const proxyUrl = imgproxy.builder().format('webp').generateUrl(url)
  return await MessageMedia.fromUrl(proxyUrl, { unsafeMime: true })
}

// Make MessageMedia into badge.
export const badge = async (media: MessageMedia) => {
  let extension = media.mimetype.split('/')[1].toLowerCase()
  console.log('Pre Convert')
  console.log(media)
  // Convert to GIF if it's MP4
  if (extension === 'mp4') {
    media = await mp4ToGif(media)
    extension = 'gif'
  }
  console.log('Post Convert')
  console.log(media)

  // Read media as Buffer
  const img = Buffer.from(media.data, 'base64')
  console.log('read media buffer')

  // Badge overlay
  const badge = Buffer.from(
    '<svg><rect x="0" y="0" width="512" height="512" rx="256" ry="256"/></svg>'
  )

  // Convert to (animated) webp badge and update media metadata
  console.log('Converting to badge')
  media.data = (
    await sharp(img, { animated: true })
      .webp()
      .resize(512, 512, { fit: 'cover' })
      .composite([
        {
          input: badge,
          blend: 'dest-in',
          tile: true,
          gravity: 'northwest'
        }
      ])
      .toBuffer()
  ).toString('base64')
  media.filesize = media.data.length
  media.mimetype = 'image/webp'
  media.filename = media.filename?.replace(extension, 'webp')
  console.log('Converted to badge')
  console.log(media)
  await fs.writeFile('/tmp/test.webp', media.data, { encoding: 'base64' })

  // All done, return the modified media object
  return media
}

// Use ffmpeg to convert mp4 to gif so it can be used with sharp
const mp4ToGif = async (media: MessageMedia) => {
  console.log('Converting mp4 to gif')

  // Create a file path and save the mp4
  const mp4File = path.join(tmpdir(), media.filename || 'tmp.mp4')
  console.log(mp4File)
  await fs.writeFile(mp4File, media.data, { encoding: 'base64' })

  // Use ffmpeg to convert the file and return new file path (gif)
  const gifFile = await new Promise<string>(async (resolve, reject) => {
    ffmpeg({ source: mp4File })
      .on('error', (error) => reject(error))
      .on('end', async () => {
        // Delete the mp4 when conversion ends
        console.log(mp4File.replace('.mp4', '.gif'))
        await fs.unlink(mp4File)
        resolve(mp4File.replace('.mp4', '.gif'))
      })
      .save(mp4File.replace('.mp4', '.gif'))
  })
  console.log(gifFile)
  // Replace media.data with gif data and adjust size/mime
  media.data = await fs.readFile(gifFile, 'base64')
  media.filesize = media.data.length
  media.mimetype = 'image/gif'
  media.filename = media.filename?.replace('.mp4', '.gif')

  // Delete gif file
  await fs.unlink(gifFile)
  // Return the new media object
  return media
}