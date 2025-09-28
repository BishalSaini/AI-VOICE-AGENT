import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const CreateUser = mutation({
    args: {
        name: v.string(),
        email: v.string(),
    },
    handler: async (ctx, args) => {
        // Find existing user by email
        const userData = await ctx.db.query('users')
            .filter(q => q.eq(q.field('email'), args.email))
            .collect();
        if (userData?.length == 0) {
            const data = {
                name: args.name,
                email: args.email,
                credits: 50000,
            };
            const result = await ctx.db.insert('users', data);
            return result;
        }
        return userData[0];
    }
});

export const getAllUsers = query(async (ctx) => {
  return await ctx.db.query("users").collect();
});
