import { Db } from 'mongodb'
import { EMAIL_COLLATION } from './auth'

/** Case-insensitive match, so "GREEN LINE" finds "Green Line". */
export async function findCompanyByName(db: Db, name: string) {
  return db.collection('companies').findOne({ name }, { collation: EMAIL_COLLATION })
}
