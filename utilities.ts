import type { Collection } from "mongodb";
import type { UserModel, BookModel, User, Book } from "./types.ts";

export const fromModelToUser = async (
    userDB: UserModel,
    BookCollection: Collection<BookModel>
):Promise<User> => {
    const books = await BookCollection.find({_id:{$in:userDB.books}}).toArray();
    return {
        id: userDB._id!.toString(),
        name: userDB.name,
        email:userDB.email,
        age:userDB.age,
        books: books.map((u)=>fromModelToBook(u))
    }
}

export const fromModelToBook = (model: BookModel):Book =>({
    id:model._id!.toString(),
    title:model.title,
    pages:model.pages
})