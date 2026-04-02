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
      return res.status(401).json({ message: 'Ало, пользователь не авторизован 😑' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Вы бесправный😂' });
    }

    next();
  };
};

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
            "SELECT id FROM User WHERE username=?"
        ).get(username)
        if (existing)
            return res.status(409).json({ error: "Такой пользователь уже существует" })
        const salt = bcr.genSaltSync(10)
        const hash = bcr.hashSync(password, salt)
        const user = db.prepare(`
            INSERT INTO User(username, email, password, role)
            VALUES(?, ?, ?, 'user') 
            `).run(username.trim(), email.trim(), hash)
        const newUser = db.prepare(`SELECT * FROM User WHERE id=?`).get(user.lastInsertRowid)

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
            "SELECT * FROM User WHERE username=?").get(username)
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
app.get("/api/auth/profile", auth, (req, res) => {
    try {
        const user = db.prepare(
            "SELECT * FROM User WHERE id = ?"
        ).get(req.user.id)
        const { password, ...safeUser } = user
        return res.status(200).json(safeUser)
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Что-то пошло не так..." })
    }
})

//Список всех книг
app.get("/api/books", (req, res) => {
    try {
        const { author, genre } = req.query;
        let query = "SELECT * FROM Books";
        let params = [];
        let conditions = [];

        if (author) {
            conditions.push("author = ?");
            params.push(author);
        }
        if (genre) {
            conditions.push("genre = ?");
            params.push(genre);
        }

        if (conditions.length > 0) {
            query += " WHERE " + conditions.join(" AND ");
        }

        query += " ORDER BY id DESC";
        
        const books = db.prepare(query).all(...params);
        return res.status(200).json(books);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Failed to fetch books" });
    }
});

//Получить книгу по id
app.get("/api/books/:id", (req, res) => {
    try {
        const { id } = req.params
        const book = db.prepare("SELECT * FROM Books WHERE id = ?").get(id)
        if (!book) {
            return res.status(404).json({ error: "Ало, книги нет такой😑" })
        }
        const reviews = db.prepare(`
            SELECT Reviews.*, User.username 
            FROM Reviews 
            JOIN User ON Reviews.userId = User.id 
            WHERE Reviews.bookId = ?
            ORDER BY Reviews.createdAt DESC
        `).all(id)
        res.status(200).json({ ...book, reviews })   
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Опшипка 💩" })
    }
})

//Добавить новую книгу📚
app.post("/api/books", auth, (req, res) => {
    console.log(req.body)
    try {
        const { title, author, year, genre, description } = req.body

        if (!title || !title.trim()) {
            return res
                .status(400)
                .json({ error: "Нужно название😰" })
        }
        if (!author || !author.trim()) {
            return res
                .status(400)
                .json({ error: "Нужен автор😰" })
        }
        if (!year || year <= 0) {
            return res
                .status(400)
                .json({ error: "Неподходящий год😰" })
        }
        if (!genre || !genre.trim()) {
            return res
                .status(400)
                .json({ error: "Нужен жанр😰" })
        }
        if (!description || !description.trim()) {
            return res
                .status(400)
                .json({ error: "Нужно описание😰" })
        }

        const info = db.prepare(`
            INSERT INTO Books(title, author, year, genre, description, createdBy)
            VALUES(?, ?, ?, ?, ?, ?)
            `).run(title.trim(), author.trim(), parseFloat(year), genre.trim(), description.trim(), req.user.id)
        const newBooks = db
            .prepare("SELECT * FROM Books WHERE id = ?")
            .get(info.lastInsertRowid)
        return res.status(201).json(newBooks)
    } catch (err) {
        console.error(err)
        return res.status(500).json({ error: "Failed error😵" })
    }
})

//Обновить книгу
app.put("/api/books/:id", auth, (req, res) => {
    try {
        const { id } = req.params
        const { title, author, year, genre, description } = req.body
        const book = db.prepare("SELECT * FROM Books WHERE id = ?").get(id)
        if (!book) {
            return res.status(404).json({ error: "Ало, книги нет такой😑" })
        }
        
        if (book.createdBy !== req.user.id && req.user.role !== "admin") {
            return res.status(403).json({ error: "Вы бесправный😂" })
        }
    
        const updates = []
        const params = []
    
        if (title && title.trim()) {
            updates.push("title = ?")
            params.push(title.trim())
        }
        if (author && author.trim()) {
            updates.push("author = ?")
            params.push(author.trim())
        }
        if (year && year > 0) {
            updates.push("year = ?")
            params.push(parseInt(year))
        }
        if (genre && genre.trim()) {
            updates.push("genre = ?")
            params.push(genre.trim())
        }
        if (description && description.trim()) {
            updates.push("description = ?")
            params.push(description.trim())
        }
        if (updates.length === 0) {
            return res.status(400).json({ error: "Нет данных для обновления" })
        }
        
        params.push(id)
        const query = `UPDATE Books SET ${updates.join(", ")} WHERE id = ?`
        db.prepare(query).run(...params)

        const updatedBook = db.prepare("SELECT * FROM Books WHERE id = ?").get(id)
        res.status(200).json(updatedBook)
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Опшипка 💩" })
    }
})
//Удалить книгу
app.delete("/api/books/:id", auth, (req, res) => {
         try {
        const { id } = req.params;
        const book = db.prepare("SELECT * FROM Books WHERE id = ?").get(id);

        if (!book) {
            return res.status(404).json({ error: "Ало, книги нет такой😑" });
        }
        if (req.user.role !== "admin" && book.createdBy !== req.user.id) {
            return res.status(403).json({ error: "Вы бесправный😂" });
        }
        db.prepare("DELETE FROM books WHERE id = ?").run(id);
        return res.status(200).json({ message: "Книга удалена😋" });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Опшипка 💩" });
    }
 });

 // Добавить отзыв🏋
app.post("/api/books/:id/reviews", auth, (req, res) => {
    try {
        const { id } = req.params
        const { rating, comment } = req.body
        const book = db.prepare("SELECT id FROM Books WHERE id = ?").get(id)
        if (!book) {
            return res.status(404).json({ error: "Ало, книги нет такой😑" })
        }
        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ error: "Оценка должна быть от 1 до 5😱" })
        }
        if (!comment || !comment.trim()) {
            return res.status(400).json({ error: "Комментарий нада👻" })
        }
        const existingReview = db.prepare(`
            SELECT id FROM Reviews WHERE bookId = ? AND userId = ?
        `).get(id, req.user.id)
        const result = db.prepare(`
            INSERT INTO Reviews (bookId, userId, rating, comment)
            VALUES (?, ?, ?, ?)
        `).run(id, req.user.id, rating, comment.trim())
        const newReview = db.prepare(`
            SELECT Reviews.*, User.username 
            FROM Reviews 
            JOIN User ON Reviews.userId = User.id 
            WHERE Reviews.id = ?
        `).get(result.lastInsertRowid)  
        res.status(201).json(newReview) 
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Опшипка 💩" })
    }
})

//Все отзывы к книге
app.get("/api/books/:id/reviews", (req, res) => {
    try {
        const { id } = req.params
        
        const book = db.prepare("SELECT id FROM Books WHERE id = ?").get(id)
        if (!book) {
            return res.status(404).json({ error: "Ало, книги нет такой😑" })
        }
        
        const reviews = db.prepare(`
            SELECT Reviews.*, User.username 
            FROM Reviews 
            JOIN User ON Reviews.userId = User.id 
            WHERE Reviews.bookId = ?
            ORDER BY Reviews.createdAt DESC
        `).all(id)
        
        res.status(200).json(reviews)
        
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Опшипка 💩" })
    }
})

//Удалить отзыв
app.delete("/api/reviews/:id", auth, (req, res) => {
    try {
        const { id } = req.params
        
        const review = db.prepare("SELECT * FROM Reviews WHERE id = ?").get(id)
        if (!review) {
            return res.status(404).json({ error: "Ало, отзыва нет такого😑" })
        }

        if (review.userId !== req.user.id && req.user.role !== "admin") {
            return res.status(403).json({ error: "Вы бесправный😂" })
        }
    
        db.prepare("DELETE FROM Reviews WHERE id = ?").run(id)
        res.status(200).json({ message: "Отзыв успешно удален😋" })
        
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Опшипка 💩" })
    }
})

app.get("/api/admin/users", auth, (req, res) => {
    try {
        if (req.user.role !== "admin") {
            return res.status(403).json({ error: "Ха-ха ты без прав" });
        }
        const users = db.prepare("SELECT id, username, email, role FROM User").all();
        return res.status(200).json(users);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Опшипка 💩" });
    }
});

app.delete('/api/admin/users/:id', auth, checkRole('admin'), (req, res) => {
    try{
        const  { id } = req.params
        const users = db.prepare(`SELECT * FROM User WHERE id=?`).get(id)
        if (!users) return res.status(404).json({error:"Ало, пользователя нет такова😑"})
        db.prepare("DELETE FROM User WHERE id = ?").run(id)
        return res.status(200).json({message: "User delete"})
    }catch (error){
        console.error(error)
        return res.status(500).json({ error: "Something went wrong" })
    }
})

app.listen(PORT)