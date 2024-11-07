import { MongoClient, ObjectId } from "mongodb";
import { fromModelToBook, fromModelToUser } from "./utilities.ts";
import type { BookModel, UserModel } from "./types.ts";

// Connection URL
const url = Deno.env.get("MONGO_URL");
if (!url) {
  console.error("MONGO_URL is not set");
  Deno.exit(1);
}
const client = new MongoClient(url);

// Database Name
const dbName = "nebrijadb";
await client.connect();
console.log("Connected successfully to server");

const db = client.db(dbName);
const UserCollection = db.collection<UserModel>("users");
const BookCollection = db.collection<BookModel>("books");

const handler = async (req: Request): Promise<Response> => {
  const method = req.method;
  const url = new URL(req.url);
  const path = url.pathname;

  if (method === "GET") {
    if (path === "/users") {
      const name = url.searchParams.get("name");
      if (name) {
        const userDB = await UserCollection.find({ name }).toArray();
        const users = await Promise.all(
          userDB.map((u) => fromModelToUser(u, BookCollection))
        );
        return new Response(JSON.stringify(users));
      } else {
        const userDB = await UserCollection.find().toArray();
        const users = await Promise.all(
          userDB.map((u) => fromModelToUser(u, BookCollection))
        );
        return new Response(JSON.stringify(users));
      }
    } else if (path === "/user") {
      const name = url.searchParams.get("name");
      if (!name) return new Response("Bad request", { status: 400 });
      const userDB = await UserCollection.findOne({
        name: name,
      });
      if (!userDB) return new Response("User not found", { status: 404 });
      const user = await fromModelToUser(userDB, BookCollection);
      return new Response(JSON.stringify(user));
    } else if (path === "/books") {
      const title = url.searchParams.get("title");
      if (title) {
        const bookDB = await BookCollection.find({ title }).toArray();
        const books = bookDB.map((b) => fromModelToBook(b));
        return new Response(JSON.stringify(books));
      } else {
        const bookDB = await BookCollection.find().toArray();
        const books = bookDB.map((b) => fromModelToBook(b));
        return new Response(JSON.stringify(books));
      }
    } else if (path === "/book") {
      const id = url.searchParams.get("id");
      if (!id) return new Response("Bad Request", { status: 400 });
      const bookDB = await BookCollection.findOne({ id });
      if (!bookDB) return new Response("Book not found", { status: 404 });
      const book = fromModelToBook(bookDB);
      return new Response(JSON.stringify(book));
    }
  } else if (method === "POST") {
    if (path === "/user") {
      const user = await req.json();
      if (!user.name || !user.email || !user.age) {
        return new Response("Bad Request", { status: 400 });
      }
      const userDB = await UserCollection.findOne({
        email: user.email,
      });
      if (userDB) return new Response("User already exist", { status: 409 });

      const { insertedId } = await UserCollection.insertOne({
        _id: user.id,
        name: user.name,
        age: user.age,
        email: user.email,
        books: [],
      });

      return new Response(
        JSON.stringify({
          name: user.name,
          age: user.age,
          email: user.email,
          books: [],
          id: insertedId,
        }),
        { status: 201 }
      );
    } else if (path === "/book") {
      const book = await req.json();
      if (!book.title || !book.pages)
        return new Response("Bad request", { status: 400 });
      const bookDB = await BookCollection.findOne({
        title: book.title,
      });
      if (bookDB) return new Response("Book already exist", { status: 409 });

      const { insertedId } = await BookCollection.insertOne({
        _id: book.id,
        title: book.title,
        pages: book.pages,
      });

      return new Response(
        JSON.stringify({
          id: insertedId,
          title: book.title,
          pages: book.pages,
        }),
        { status: 201 }
      );
    }
  } else if (method === "PUT") {
    if (path === "/user") {
      const user = await req.json();
      if (!user.name || !user.email || !user.age) {
        return new Response("Bad Request", { status: 400 });
      }
      if (user.books) {
        const books = await BookCollection.find({
          _id: { $in: user.book.map((id: string) => new ObjectId(id)) },
        }).toArray();
        if (books.length !== user.books.length) {
          return new Response("Book not found", { status: 404 });
        }
      }

      const { modifiedCount } = await UserCollection.updateOne(
        { email: user.email },
        {
          $set: {
            name: user.name,
            age: user.age,
            email: user.email,
            books: user.books,
          },
        }
      );

      if (modifiedCount === 0) {
        return new Response("User not found", { status: 404 });
      }
      return new Response("OK", { status: 200 });
    } else if (path === "/book") {
      const book = await req.json();
      if (!book.id || !book.title || !book.pages) {
        return new Response("Bad Request", { status: 400 });
      }
      const { modifiedCount } = await BookCollection.updateOne(
        { _id: new ObjectId(book.id as string) },
        { $set: { title: book.title, pages: book.pages } }
      );
      if (modifiedCount === 0) {
        return new Response("Book not found", { status: 404 });
      }
      return new Response("OK", { status: 200 });
    }
  } else if (method === "DELETE") {
    if (path === "/user") {
      const id = url.searchParams.get("id");
      if (!id) return new Response("Bad request", { status: 400 });
      const { deletedCount } = await UserCollection.deleteOne({
        _id: new ObjectId(id),
      });

      if (deletedCount === 0) {
        return new Response("User not found", { status: 404 });
      }

      return new Response("User deleted", { status: 200 });
    } else if (path === "/book") {
      const id = url.searchParams.get("id");
      if (!id) return new Response("Bad request", { status: 400 });
      const { deletedCount } = await BookCollection.deleteOne({
        _id: new ObjectId(id),
      });

      if (deletedCount === 0) {
        return new Response("Book not found", { status: 404 });
      }

      await UserCollection.updateMany(
        { books: new ObjectId(id) },
        { $pull: { books: new ObjectId(id) } }
      );

      return new Response("Book deleted", { status: 200 });
    }
  }
  return new Response("Endpoint not found", { status: 404 });
};
Deno.serve({ port: 3000 }, handler);
