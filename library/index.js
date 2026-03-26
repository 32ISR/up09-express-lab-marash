const express = require("express")
const db = require("./db")
const bcr = require("bcryptjs")
const jwt = require("jsonwebtoken")

const app = express()
app.use(express.json())
const SECRET = ("sdjjreicdjhfsxnddfjdfeoefhjsdlridxlpofdkenwlscdjsiekpscfjserhbzpdscls1293747590")

const PORT = 3000

const auth = (req, res, next) => {
    const authHeader = req.headers.authorization
    if (!authHeader) return res.status(401).json({ error: "No token error" })
    const token = authHeader.split(" ")[1]
    if (!token) return res.status(401).json({ error: "Invalid token form" })
    try {
        const decoded = jwt.verify(token, SECRET)
        req.user = decoded
        next()
    }
    catch (error) {
        if (!token) return res.status(403).json({ error: "Invalid or expired token" })
    }
}
function checkRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Пользователь не авторизован' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Доступ запрещен: недостаточно прав' });
    }

    next();
  };
};



app.get('/api/admin/users', auth, checkRole('admin'), (req, res) => {
    const users = db.prepare(
        "SELECT id, username, email, role FROM User"
    ).all()
})
app.delete('/api/admin/users/:id', auth, checkRole('admin'), (req, res) => {
    try{
        const  { id } = req.params
        const users = db.prepare(`SELECT * FROM User WHERE id=?`).get(id)
        if (!users) return res.status(404).json({error:"Пользователь не найден"})
        db.prepare("DELETE FROM items WHERE id = ?").run(id)
        return res.status(200).json({message: "User delete"})
    }catch (error){
        console.error(error)
        return res.status(500).json({ error: "Something went wrong" })
    }
})

//Регистрация
app.post("/api/auth/register", (req, res) => {
    try {
        const { username, password, email } = req.body
        if (!username || !password) {
            return res.status(400).json({ error: "Нужно ввести логин или пароль" })
        }
        if (username.length < 3) {
            return res.status(400).json({ error: "Логин должен быть больше 3 символов" })
        }
        if (password.length < 6) {
            return res.status(400).json({ error: "Пароль должен быть больше 6 символов" })
        }
        const existing = db.prepare(
            "SELECT id FROM users WHERE username=?"
        ).get(username)
        if (existing)
            return res.status(409).json({ error: "Такой пользователь уже существует" })
        const salt = bcr.genSaltSync(10)
        const hash = bcr.hashSync(password, salt)
        const user = db.prepare(`
            INSERT INTO users(username, email, password, role)
            VALUES(?, ?, ?, user) 
            `).run(username.trim(), email.trim(), hash)
        const newUser = db.prepare(`SELECT * FROM users WHERE id=?`).get(user.lastInsertRowid)

        const { password: _, ...safeUser } = newUser

        const token = jwt.sign({ ...safeUser }, SECRET, { expiresIn: "24h" })
        res.status(201).json({ success: true, token, user: safeUser })

    } catch (err) {
        console.error(err)
        return res.status(500).json({ error: "Server failed" })
    }
})

//Вход в аккаунт
app.post("/api/auth/login", (req, res) => {
    try {
        const { username, password } = req.body
        if (!username || !password) {
            return res.status(400).json({ error: "Нужно ввести логин или пароль" })
        }
        const user = db.prepare(
            "SELECT * FROM users WHERE username=?").get(username)
        if (!user) return res.status(401).json({ error: "Неправильный пароль" })
        const valid = bcr.compareSync(password, user.password)
        if (!valid) return res.status(401).json({ error: "Неправильный пароль" })
        const { password: _, ...safeUser } = user
        const token = jwt.sign({ ...safeUser }, SECRET, { expiresIn: "24h" })
        res.status(200).json({ success: true, token, user: safeUser })

    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Something went wrong" })
    }
})

//Данные текущего пользователя
app.get("/api/auth/profile", auth, (req, res) =>{
    const user = db.prapare("SELECT id, username, email, role FROM User WHERE id=?")
        .get(req.user.id)
})

//Добавить новую книгу
app.post("/api/items", auth, (req, res) => {
    console.log(req.body)
    try {
        const { title, author, year, genre, description } = req.body

        if (!title || !title.trim()) {
            return res
                .status(400)
                .json({ error: "Нужно название" })
        }
        if (!author || !author.trim()) {
            return res
                .status(400)
                .json({ error: "Нужен автор" })
        }
        if (!year || year <= 0) {
            return res
                .status(400)
                .json({ error: "Неподходящий год" })
        }
        if (!genre || !genre.trim()) {
            return res
                .status(400)
                .json({ error: "Нужен жанр" })
        }
        if (!description || !description.trim()) {
            return res
                .status(400)
                .json({ error: "Нужно описание" })
        }

        const info = db.prepare(`
            INSERT INTO Books(title, author, year, genre, description, createdBy)
            VALUES(?, ?, ?, ?, ?, ?)
            `).run(title.trim(), author.trim(), parseFloat(year), genre.trim(), description.trim(), req.user.username)
        const newItem = db
            .prepare("SELECT * FROM Books WHERE id = ?")
            .get(info.lastInsertRowid)
        return res.status(201).json(newItem)
    } catch (err) {
        console.error(err)
        return res.status(500).json({ error: "Failed error" })
    }
})


//Удалить книгу
app.delete("/api/books/:id", auth, (req, res) => {
     try{
       const book = db.prepare("SELECT * FROM books WHERE id = ?").get(req.params.id);
     if (!book) return res.status(404).json({ error: "Книга не найдена" });
     if (book.createdBy !== req.user.id && req.user.role !== "admin") {
         return res.status(403).json({ error: "Не ваша книга" });
     }
    
    db.prepare("DELETE FROM books WHERE id = ?").run(id)
         return res.status(200).json({message: "Книга удалена"})
     }catch (error){
         console.error(error)
         return res.status(500).json({ error: "Что-то пошло не так" })
     }
 });


app.listen(PORT)