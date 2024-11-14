import { describe, it, expect } from 'bun:test'
import { db, $ } from './db'
import { table, column, pick, useFilter } from 'litdb'
import { Order } from './data'

@table() class Contact {
    constructor(data?: Partial<Contact>) { Object.assign(this, data) }
    @column("INTEGER",  { autoIncrement:true }) id = 0
    @column("TEXT",     { required:true }) name = ''
    @column("TEXT",     { required:true, index:true, unique:true }) email = ''
    @column("DATETIME", { defaultValue:"CURRENT_TIMESTAMP" }) createdAt = new Date()
}

describe('PostgreSQL Driver Example Tests', () => {

    it ('Can run litdb.dev example', async () => {
        const sorted = {
            ids: [1,2,3,4,5],
            emails: ["alice@mail.org","bob@mail.org","jane@mail.org","joe@doe.org","john@mail.org"],
            names: ['Alice','Bob','Jane Doe','Jo','John Doe']
        }

        await db.dropTable(Order)
        await db.dropTable(Contact)

        // useFilter(db, sql => console.log(sql))
        await db.createTable(Contact)
        await db.insertAll([
            new Contact({ name:"John Doe", email:"john@mail.org" }),
            new Contact({ name:"Jane Doe", email:"jane@mail.org" }),
        ])
        
        const janeEmail = 'jane@mail.org'
        const jane = (await db.one<Contact>($.from(Contact).where(c => $`${c.email} = ${janeEmail}`)))!

        // Insert examples
        const { lastInsertRowid:bobId } = await db.insert(new Contact({ name:"Bob", email:"bob@mail.org" }))
        expect(bobId).toBe(3)
        // useFilterSync(db, sql => console.log(sql))
        const { lastInsertRowid } = await db.exec`INSERT INTO Contact(name,email) VALUES ('Jo','joe@doe.org')`
        expect(lastInsertRowid).toBe(4)
        const name = 'Alice', email = 'alice@mail.org'
        await db.exec`INSERT INTO Contact(name,email) VALUES (${name}, ${email})`
        const alice = (await db.one`SELECT name,email from Contact WHERE email = ${email}`)! as Contact
        expect(pick(alice, ['name','email'])).toEqual({ name, email })

        // Typed SQL fragment example
        const hasId = <Table extends { id:number }>(id:number|bigint) =>
            (x:Table) => $.sql($`${x.id} = $id`, { id })

        const bob = await db.one($.from(Contact).where(hasId(bobId)).into(Contact)) // => Contact    
        expect(pick(bob!, ['name','email'])).toEqual({ name:"Bob", email:"bob@mail.org" })
        const contacts = await db.all($.from(Contact).into(Contact))                // => Contact[]
        expect(contacts.length).toBe(sorted.ids.length)
        const contactsCount = await db.value($.from(Contact).select`COUNT(*)`)      // => number
        expect(contactsCount).toBe(sorted.ids.length)
        const emails = await db.column($.from(Contact).select(c => $`${c.email}`))  // => string[]
        expect(emails.toSorted()).toEqual(sorted.emails)
        const dbContactsArray = await db.arrays($.from(Contact))                    // => any[][]
        expect(dbContactsArray.length).toBe(sorted.ids.length)
        expect(dbContactsArray.map(x => x[0]).toSorted()).toEqual(sorted.ids)
        expect(dbContactsArray.map(x => x[1]).toSorted()).toEqual(sorted.names)
        expect(dbContactsArray.map(x => x[2]).toSorted()).toEqual(sorted.emails)
        const bobArray = await db.array($.from(Contact).where(hasId(bobId)))        // => any[]
        expect(bobArray).toEqual([3,"Bob","bob@mail.org", bobArray![3]])

        // Update examples
        jane.email = 'jane@doe.org'
        await db.update(jane)                           // Update all properties
        expect(await db.value($.from(Contact).select`email`.where`id = ${jane.id}`)).toEqual(jane.email)
        
        jane.email = 'jane2@doe.org'
        await db.update(jane, { onlyProps:['email'] })  // Update only email
        expect(await db.value($.from(Contact).select`email`.where`id = ${jane.id}`)).toEqual(jane.email)
        
        jane.email = 'jane3@doe.org'
        await db.exec($.update(Contact).set({ email:jane.email }).where(hasId(jane.id))) // query builder
        expect(await db.value($.from(Contact).select`email`.where`id = ${jane.id}`)).toEqual(jane.email)

        // Delete examples
        await db.delete(jane)
        await db.exec($.deleteFrom(Contact).where(hasId(jane.id))) // query builder

        const noJane = await db.one<Contact>($.from(Contact).where(c => $`${c.email} = ${janeEmail}`))
        expect(noJane).toBe(null)
    })

})
