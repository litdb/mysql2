# mysql

litdb driver for [node-mysql2](https://github.com/sidorares/node-mysql2)

## Install

```sh
npm install @litdb/mysql
```

## Usage

**db.ts**

```ts
import { connect } from "@litdb/mysql"

export const connection = connect({ hostname, database, user, password })
export const { $, async:db, native } = connection
```

> When needed use `native` to access underlying node-mysql2 driver

**app.ts**

```ts
import { $, db } from "./db"
import { Contact } from "./models"

await db.dropTable(Contact)
await db.createTable(Contact)
await db.insertAll([
    new Contact({ name:"John Doe", email:"john@mail.org" }),
    new Contact({ name:"Jane Doe", email:"jane@mail.org" }),
])

const janeEmail = 'jane@mail.org'
const jane = await db.one<Contact>($.from(Contact).where(c => $`${c.email}=${janeEmail}`))

// Insert examples
const { lastInsertRowid:bobId } = await db.insert(
    new Contact({ name:"Bob", email:"bob@mail.org"}))

const { lastInsertRowid } = await db.exec
    `INSERT INTO Contact(name,email) VALUES('Jo','jo@doe.org')`

const name = 'Alice', email = 'alice@mail.org'
await db.exec`INSERT INTO Contact(name,email) VALUES (${name}, ${email})`

// Typed SQL fragment with named param example
const hasId = <Table extends { id:number }>(id:number|bigint) =>
    (x:Table) => $.sql($`${x.id} = $id`, { id })

const contacts = await db.all($.from(Contact).into(Contact))                // => Contact[]
const bob = await db.one($.from(Contact).where(hasId(bobId)).into(Contact)) // => Contact
const contactsCount = await db.value($.from(Contact).select`COUNT(*)`)      // => number
const emails = await db.column($.from(Contact).select(c => $`${c.email}`))  // => string[]
const contactsArray = await db.arrays($.from(Contact))                      // => any[][]
const bobArray = await db.array($.from(Contact).where(hasId(bobId)))        // => any[]

// Update examples
jane.email = 'jane@doe.org'
await db.update(jane)                           // Update all properties
await db.update(jane, { onlyProps:['email'] })  // Update only email
// query builder
await db.exec($.update(Contact).set({ email:jane.email }).where(hasId(jane.id)))

// Delete examples
await db.delete(jane)
await db.exec($.deleteFrom(Contact).where(hasId(jane.id))) // query builder
```

Website: https://litdb.dev