import { connect } from "../src"

export const connection = connect({ host:'localhost',database:'test',user:'root',password:'p@55wOrd' })
export const { $, async:db, native } = connection