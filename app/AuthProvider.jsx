"use client";
import React, { useEffect, useState, createContext } from 'react' 
import {api} from "../convex/_generated/api"; 
import {useMutation } from "convex/react";  
import {useUser} from '@stackframe/stack'
import { UserContext } from './_context/UserContext';

function AuthProvider(props) { 
    const user = useUser();  
    const CreateUser = useMutation(api.users.CreateUser); // Use the API to create a user
    const [userData, setUserData] = useState();
    useEffect(() => {
      if (user && user.primaryEmail) {
        CreateNewUser();
      }
    }, [user]); 

    const CreateNewUser = async () => {
      console.log("User object:", user); // Log the whole user object
      const result = await CreateUser({ 
        name: user?.displayName,   // Use displayName
        email: user?.primaryEmail  // Use primaryEmail
      });
      console.log(result); 
      setUserData(result); // Set the user data in state
    };

    return (
      <div> 
        <UserContext.Provider value={{ userData, setUserData }}>
          {props.children}
        </UserContext.Provider>
      </div>
    )
}

export default AuthProvider
