import Jimp from 'jimp'
import qs from 'qs'
import { MessageMedia } from 'whatsapp-web.js'

import { imgproxy } from '../config'
import { GiphySearch } from '../types/Giphy'
import { TenorSearch } from '../types/Tenor'

export const paramSerializer = (p: TenorSearch | GiphySearch) => {
  return qs.stringify(p, { arrayFormat: 'brackets' })
}

export const oneChanceIn = (odds: number) => {
  return Math.floor(Math.random() * odds) === 0
}

export const proxyImage = async (url: string) => {
  // Do nothing if imgproxy is not set
  if (!imgproxy) return await MessageMedia.fromUrl(url)
  const proxyUrl = imgproxy.builder().format('webp').generateUrl(url)
  return await MessageMedia.fromUrl(proxyUrl, { unsafeMime: true })
}

export const autoCrop = async (b64: string) => {
  console.log(b64)
  // Load the image into Jimp
  const image = await Jimp.read(Buffer.from(b64, 'base64'))

  // Auto crop the image
  const croppedImage = image.autocrop()

  const retb64 = await croppedImage.getBase64Async(Jimp.MIME_PNG)
  console.log(retb64)
  // Convert the image to a base64 encoded string
  return await retb64
}
