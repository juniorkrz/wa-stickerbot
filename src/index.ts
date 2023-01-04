/* eslint-disable import/no-unresolved */
import express from 'express'
import * as QRCode from 'qrcode'
import { Chat, Client, ContactId, GroupChat, Message } from 'whatsapp-web.js'

import { botOptions, clientConfig } from './config'
import { getDonors, isBanned } from './handlers/dbHandler'
import { handleMedia } from './handlers/mediaHandler'
import { handleText } from './handlers/textHandler'
import { oneChanceIn } from './utils/utils'

export const waClient: Client = new Client(clientConfig)
export let isAdmin: boolean, isOwner: boolean, amAdmin: boolean
export let chat: Chat
export let group: GroupChat
export let sender: string
export let me: ContactId

let authQr = ''
let ready = false

const start = async () => {
  // Message Handlers
  void waClient.on('message', async (message: Message) => {
    // Do not act on self messages
    if (message.fromMe) return

    // Who am I?
    me = waClient.info.wid

    // Get Chat
    chat = await message.getChat()
    if (chat.isGroup) group = <GroupChat>chat

    // Set sender
    sender = (await message.getContact()).id.user

    // Test if the sender is an owner
    isOwner = sender === botOptions.ownerNumber

    // Test if the sender is an admin
    if (chat.isGroup)
      isAdmin = !!group.participants.find(
        (p) => p.isAdmin && p.id.user === sender
      )

    // Test if I am an admin
    if (chat.isGroup)
      amAdmin = group.participants.filter((p) => p.id.user === me.user)[0]
        .isAdmin

    // Skips personal chats unless specified
    if (!chat.isGroup) {
      if (botOptions.groupsOnly) {
        return
      }
    } else {
      // Skips non-administered groups unless specified
      if (botOptions.groupAdminOnly && !amAdmin) {
        return
      }
    }

    // Delete messages of banned users, except Owner
    if (!isOwner && (await isBanned(message.from.replace(/\D/g, '')))) {
      await message.delete(true)
      return
    }

    // Handle Media
    if (message.hasMedia) {
      await message.react('🤖')
      handleMedia(message)
    } else {
      // Handle Text
      await handleText(message)
    }

    // One chance in X to send a Donation link (except if Admin or Owner)
    if (
      botOptions.donationLink &&
      oneChanceIn(botOptions.donationChance) &&
      !isOwner &&
      !isAdmin
    ) {
      const donors = await getDonors()
      let msg = botOptions.donationLink
      if (donors) msg += `\n\n${await getDonors()}`
      await chat.sendMessage(msg)
    }

    // Stop typing
    await chat.clearState()
  })
}

// Web Server
const server = express()

// Clean (not delete) all chats
server.get('/clean', async (_req, res) => {
  if (!ready) return
  console.log('Deleting messages...')
  const chats = await waClient.getChats()
  await Promise.all(
    chats.map(async (chat) => {
      await chat.clearMessages()
    })
  )
  console.log(`${chats.length} chats cleared.`)
  res.end(`${chats.length} chats cleared.`)
})

// Clear (delete) all chats (except Group chats)
server.get('/clear', async (_req, res) => {
  if (!ready) return
  console.log('Deleting chats...')
  const chats = await (await waClient.getChats()).filter((c) => !c.isGroup)
  await Promise.all(
    chats.map(async (chat) => {
      await chat.delete()
    })
  )
  console.log(`${chats.length} chats deleted.`)
  res.end(`${chats.length} chats deleted.`)
})

// Get all groups
server.get('/groups', async (_req, res) => {
  if (!ready) return
  const chats = (await waClient.getChats()).filter((c) => c.isGroup)
  res.json(chats).end()
})

// Get all Chats
server.get('/chats', async (_req, res) => {
  if (!ready) return
  res.json(await waClient.getChats()).end()
})

// Get QR
server.get('/qr', async (_req, res) => {
  const x = await (await QRCode.toDataURL(authQr || 'NONE'))
    .split(';base64,')
    .pop()
  res.type('png')
  res.end(Buffer.from(x || '', 'base64'))
})

server.listen(3000, () => {
  console.log('Web Server Started.')
  authQr = ''
})

waClient.initialize()
waClient.on('ready', async () => {
  await start()
})

waClient.on('qr', (qr) => {
  authQr = qr
})

waClient.on('ready', () => {
  ready = true
  console.log('Client is ready!')
})
