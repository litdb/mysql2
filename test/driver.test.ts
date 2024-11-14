import { describe, it, expect } from 'bun:test'
import { contacts, Contact, Order } from './data'
import { db, $ } from './db'
import { useFilter, omit, pick, } from 'litdb'

const recreateContacts = async () => {
    await db.dropTable(Order)
    await db.dropTable(Contact)
    await db.createTable(Contact)
    await db.insertAll(contacts)
}

describe('MySql Driver Tests', () => {

    it ('Can log contacts', async () => {
        await recreateContacts()
        const origRows = await db.all($.from(Contact))
        $.dump(origRows)
        $.dump(omit(origRows, ['phone','createdAt','updatedAt']))
        $.dump(pick(origRows, ['id','firstName','lastName','age']))
        $.dump(await db.arrays($.from(Contact).select`id, firstName, lastName, age`))
    })

    it ('can use templated string', async () => {
        await recreateContacts()
        let getContact = (id:number) => 
            db.one<Contact>`SELECT firstName, lastName FROM Contact WHERE id = ${id}`

        let contact = (await getContact(1))!
        $.log(contact)
        expect(contact.firstName).toBe('John')
        expect(contact.lastName).toBe('Doe')

        contact = (await getContact(2))!
        expect(contact.firstName).toBe('Jane')
        expect(contact.lastName).toBe('Smith')
    })

    it ('does map into Class', async () => {
        await recreateContacts()

        // No select, selects all columns of Primary table which uses 'into' implicitly
        expect(await db.one($.from(Contact).where(c => $`${c.id} = ${contacts[0].id}`))).toBeInstanceOf(Contact)
        
        await db.dropTable(Order)
        await db.createTable(Order)
        await db.insert(new Order({ contactId:1 }))
        expect(await db.one($.from(Contact).join(Order, { on:(c,o) => $`${c.id} = ${o.contactId}` }))).toBeInstanceOf(Contact)

        // Any select invalidates implicit into
        const q = $.from(Contact).where(c => $`${c.id} = ${contacts[0].id}`)
        expect(await db.one(q.select('*'))).not.toBeInstanceOf(Contact)

        // Use into to return results into class
        expect(await db.one(q.into(Contact))).toBeInstanceOf(Contact)

        const dbContacts = await db.all($.from(Contact).into(Contact))
        for (const row of dbContacts) {
            expect(row).toBeInstanceOf(Contact)
        }
    })

    it ('does Filter prepareSync', async () => {
        const sqls:string[] = []
        const sub = useFilter(db, sql => sqls.push(sql[0]))
        await db.one`SELECT 1`
        await db.one`SELECT 2`
        expect(sqls).toEqual(['SELECT 1', 'SELECT 2'])
        sub.release()
        await db.one`SELECT 3`
        expect(sqls.length).toEqual(2)
    })

    it ('Does select non existent row', async () => {
        const row = await db.one($.from(Contact).where(c => $`${c.id} = ${100}`).into(Contact))
        expect(row).toBeNull()
    })

    it ('does CRUD Contact Table', async () => {

        var sub:any = null
        // const sub = useFilter(db, sql => console.log(sql))
        
        await db.dropTable(Order)
        await db.dropTable(Contact)

        expect(await db.listTables()).not.toContain(Contact.name)

        await db.createTable(Contact)

        expect(await db.listTables()).toContain(Contact.name)

        var { changes, lastInsertRowid } = await db.insert(contacts[0])
        expect(changes).toBe(1)
        expect(lastInsertRowid).toBe(1)

        expect(await db.value($.from(Contact).select`COUNT(*)`)).toBe(1)
        expect(await db.value($.from(Contact).rowCount())).toBe(1)

        var { changes, lastInsertRowid } = await db.insertAll(contacts.slice(1))
        expect(changes).toBe(4)
        expect(lastInsertRowid).toBe(5)

        expect(await db.value($.from(Contact).rowCount())).toBe(contacts.length)

        var dbContacts = $.from(Contact).select({ props:['id','firstName','lastName','age'] }).into(Contact)
        if (sub) $.dump(await db.all(dbContacts))

        var updateContact = new Contact(contacts[0])
        updateContact.age = 40
        var { changes } = await db.update(updateContact)
        expect(changes).toBe(1)
        var { changes } = await db.update(updateContact, { onlyProps:['age'] })
        expect(changes).toBe(1)

        if (sub) $.dump(await db.all(dbContacts))

        const q = $.from(Contact).where(c => $`${c.id} = ${updateContact.id}`).into(Contact)
        const one = (await db.one(q))!
        expect(one.age).toBe(updateContact.age)

        // named props
        // sub = useFilter(db, sql => console.log(sql))
        await db.exec($.update(Contact).set({ age:41, city:'Austin', state:'Texas' }).where(c => $`${c.age} = ${updateContact.age}`))
        expect(await db.value($.from(Contact).where(c => $`${c.age} = 41`).rowCount())).toBe(2)
        
        // function
        await db.exec($.update(Contact).set(c => $`${c.age} = ${42}`).where(c => $`${c.age} = 41`))
        expect(await db.value($.from(Contact).where(c => $`${c.age} = 42`).rowCount())).toBe(2)

        // templated string
        const qUpdate = $.update(Contact)
        const c = qUpdate.ref
        await db.exec(qUpdate.set`${c.age} = ${updateContact.age}`.where`${c.age} = 42`)

        await db.delete(one)

        expect(await db.one(q)).toBeNull()

        await db.exec($.deleteFrom(Contact).where(c => $`${c.age} = 40`))
        const remaining = await db.all(dbContacts)
        if (sub) $.dump(remaining)

        expect(remaining).toBeArrayOfSize(3)
        for (const contact of remaining) {
            expect(contact.age).not.toEqual(40)
        }

        expect(await db.value($.from(Contact).select`COUNT(*)`)).toBe(remaining.length)
        expect(await db.value($.from(Contact).select`COUNT(*)`.into(Number))).toBe(remaining.length)
        expect(await db.value($.from(Contact).rowCount())).toBe(remaining.length)

        expect(await db.value($.from(Contact).where(c => $`${c.age} = 40`).exists())).toBeFalse()

        expect(await db.value($.from(Contact).exists())).toBeTrue()

        await db.exec($.deleteFrom(Contact))

        expect(await db.value($.from(Contact).exists())).toBeFalse()

        expect(await db.value($.from(Contact).select`COUNT(*)`)).toBe(0)
        expect(await db.value($.from(Contact).rowCount())).toBe(0)

        if (sub) sub.release()
    })

    it ('can select column', async () => {
        await recreateContacts()

        // const sub = useFilter(db, sql => console.log(sql))
        const q = $.from(Contact)
        expect(await db.column(q.clone().select(c => $`${c.id}`))).toEqual(contacts.map(x => x.id))

        expect(await db.column(q.clone().select(c => $`${c.firstName}`))).toEqual(contacts.map(x => x.firstName))
        
        expect(await db.column(q.clone().select(c => $`${c.age}`))).toEqual(contacts.map(x => x.age))

        expect(await db.column(q.clone().select(c => $`${c.createdAt}`))).toBeArrayOfSize(contacts.length)

        const age = 27
        expect(await db.column`SELECT age from Contact`).toEqual(contacts.map(x => x.age))
        expect(await db.column`SELECT age from Contact WHERE age = ${age}`).toEqual(contacts.filter(x => x.age == 27).map(x => x.age))
        expect(await db.column`SELECT age from Contact WHERE age = ${age}`).toEqual(contacts.filter(x => x.age == 27).map(x => x.age))
        expect(await db.column($.sql('SELECT age from Contact WHERE age = $age', { age }))).toEqual(contacts.filter(x => x.age == 27).map(x => x.age))
    })

    it ('can select arrays', async () => {
        await recreateContacts()

        const sub = false
        // const sub = useFilter(db, sql => console.log(sql))
        
        const q = $.from(Contact).select({ props:['id', 'firstName', 'lastName', 'age', 'email', 'city'] })

        const contactArrays = contacts.map(({ id, firstName, lastName, age, email, city }) => 
            [id, firstName, lastName, age, email, city])

        var dbContacts = await db.arrays(q.clone())
        if (sub) $.dump(dbContacts)

        expect(dbContacts).toEqual(contactArrays)
        expect(await db.arrays`SELECT id, firstName, lastName, age, email, city FROM Contact`).toEqual(contactArrays)
        
        const age = 27
        expect(await db.arrays`SELECT id, firstName, lastName, age, email, city FROM Contact WHERE age = ${age}`)
            .toEqual(contactArrays.filter(x => x[3] === age))

        expect(await db.arrays($.sql(`SELECT id, firstName, lastName, age, email, city FROM Contact WHERE age = $age`, { age })))
            .toEqual(contactArrays.filter(x => x[3] === age))
        
        const id = 1
        expect(await db.array(q.clone().where(c => $`${c.id} = ${id}`))).toEqual(contactArrays[0])
        expect(await db.array`SELECT id, firstName, lastName, age, email, city FROM Contact WHERE id = ${id}`).toEqual(contactArrays[0])
        expect(await db.array($.sql(`SELECT id, firstName, lastName, age, email, city FROM Contact WHERE id = $id`, { id }))).toEqual(contactArrays[0])
    })

})
