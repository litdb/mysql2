import { describe, it, expect } from 'bun:test'
import mysql from 'mysql2/promise'
  
describe('native mysql2 tests', () => {

  it ('Should connect to mysql', async () => {
      const pool = mysql.createPool({
          host: 'localhost',
          user: 'root',
          password: 'p@55wOrd',
          database: 'test',
      })

      const [ rows, fields ] = await pool.query<any[]>(`SELECT 1 AS c1, ? AS c2`, ['foo'])
      console.log('rows', rows, 'fields', fields)

      expect(rows[0]).toEqual({c1: 1, c2: 'foo'})
    })

})
