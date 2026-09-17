// mongoose is CommonJS; Node's ESM interop can't expose `models`/`Schema`/`model` as
// named exports the way Next's bundler does, so the loader routes 'mongoose' here.
import mongoose from 'mongoose'
export default mongoose
export const { Schema, model, models, Types, Document, Model, Query, connection, connect, disconnect, isValidObjectId } = mongoose
