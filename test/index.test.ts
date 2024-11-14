import { describe, it, expect } from 'bun:test'
import { contacts, Contact, Order } from './data'
import { db } from './db'

describe('MySQL Driver Tests', () => {

  it ('should be able to run a test', async () => {
    // useFilter(db, sql => console.log(sql))

    await db.dropTable(Order)
    await db.dropTable(Contact)
    await db.createTable(Contact)
    await db.insertAll(contacts)

    let getContact = (id:number) => 
        db.one<Contact>`select firstName, lastName from Contact where id = ${id}`

    let contact = (await getContact(1))!
    console.log('contact', contact)
    expect(contact.firstName).toBe('John')
    expect(contact.lastName).toBe('Doe')

    contact = (await getContact(2))!
    expect(contact.firstName).toBe('Jane')
    expect(contact.lastName).toBe('Smith')
  })

})
