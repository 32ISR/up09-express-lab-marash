const Database = require("better-sqlite3")
const bcr = require("bcryptjs")
const db = new Database("library.db")
db.pragma('foreign_keys = ON');

db.exec(`
    CREATE TABLE IF NOT EXISTS User(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'user', 
        createdAt TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS Books(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        author TEXT NOT NULL,
        year INTEGER NOT NULL,
        genre TEXT NOT NULL,
        description TEXT NOT NULL,
        createdBy INTEGER NOT NULL,
        createdAt TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (createdBy) REFERENCES User(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS Reviews(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bookId INTEGER NOT NULL,
        userId INTEGER NOT NULL,
        rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
        comment TEXT NOT NULL,
        createdAt TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (bookId) REFERENCES Books(id) ON DELETE CASCADE,
        FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE
    );
`)

const salt = bcr.genSaltSync(10)
const adminHash = bcr.hashSync('qwerty123', salt)
const userHash = bcr.hashSync('qwerty123', salt)

const insertUser = db.prepare('INSERT OR IGNORE INTO User (username, email, password, role) VALUES (?, ?, ?, ?)')

insertUser.run('admin', 'nika.marash@mail.ru', adminHash, 'admin')
insertUser.run('user', 'nikamarash95@gmail.com', userHash, 'user')

module.exports = db