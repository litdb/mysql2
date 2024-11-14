import { describe, it, expect } from 'bun:test'
import { convertNamedParams } from '../src'
import { str } from './utils'

describe('Param Tests', () => {
    it ('does convertNamedParams', () => {
        const namedParams = {
            _1: 1,
            _2: 2,
            _3: 3,
            _4: 1000,
            _5: 'WIDGET',
            _6: 'GADGET',
            _7: 'THING',
            _8: 'GIZMO',
            _9: 'DOODAD',
            _10: 10,
            _11: 20,
            limit: 50,
            offset: 100
        }
        const query = convertNamedParams(`
            SELECT c."name", o."id", p."name", p."cost", i."qty", i."total", o."total" 
              FROM "Order" o 
              LEFT JOIN "Contact" c ON c."id" = o."contactId" 
              JOIN "OrderItem" i ON o."id" = i."orderId" 
              LEFT JOIN "Product" p ON i."sku" = p."sku" 
             WHERE o."contactId" IN ($_1,$_2,$_3) AND p."cost" >= $_4 
                OR i."id" IN (SELECT "id" 
                                FROM "OrderItem" 
                               WHERE "sku" IN ($_5,$_6,$_7,$_8,$_9) 
                               GROUP BY "id" 
                               ORDER BY SUM("qty") DESC 
                               LIMIT $_10 OFFSET $_11) 
             ORDER BY o."total" 
             LIMIT $limit 
             OFFSET $offset`, namedParams)

        expect(str(query.sql)).toEqual(str(`
            SELECT c."name", o."id", p."name", p."cost", i."qty", i."total", o."total"  
              FROM "Order" o  
              LEFT JOIN "Contact" c ON c."id" = o."contactId"  
              JOIN "OrderItem" i ON o."id" = i."orderId"  
              LEFT JOIN "Product" p ON i."sku" = p."sku"  
             WHERE o."contactId" IN (?,?,?) AND p."cost" >= ?
                OR i."id" IN (SELECT "id"  
                                FROM "OrderItem"  
                               WHERE "sku" IN (?,?,?,?,?)  
                               GROUP BY "id"  
                               ORDER BY SUM("qty") DESC  
                               LIMIT ? OFFSET ?)
             ORDER BY o."total"  
             LIMIT ?
            OFFSET ?`))

        expect(query.values).toEqual(
            [ 1, 2, 3, 1000, "WIDGET", "GADGET", "THING", "GIZMO", "DOODAD", 10, 20, 50, 100])

        expect(query.paramNames).toEqual(
            ["_1", "_2", "_3", "_4", "_5", "_6", "_7", "_8", "_9", "_10", "_11", "limit", "offset"])
    })

})