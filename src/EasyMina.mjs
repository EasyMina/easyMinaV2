import { config } from './data/config.mjs'
import { Environment } from './environment/Environment2.mjs'

import { printMessages } from './helpers/mixed.mjs'
import { Account } from './environment/Account.mjs'
import { Encryption } from './environment/Encryption.mjs'

import moment from 'moment'
import fs from 'fs'


export class EasyMina {
    #config
    #state
    #environment
    #account
    #encryption


    constructor() {
        this.#config = config

        return 
    }


    init() {
        this.#account = this.#addAccount()
        this.#environment = this.#addEnvironment()
        this.#encryption = new Encryption()

        const secret = this.#environment.getSecret( {
            'filePath': null,
            'encryption': this.#encryption
        } )
    
/*
        this.#environment.createSecretFile( { 
            'encryption': this.#encryption 
        } )
*/

        this.#state = {
            'accountGroup': null,
            'projectName': null,
            'names': null
        }

        return this
    }


    setAccountGroup( accountGroup ) {
        const [ messages, comments ] = this.#validateState( { accountGroup } )
        printMessages( { messages, comments } )

        this.#state['accountGroup'] = accountGroup
        return this
    }


    setProjectName( projectName ) {
        const [ messages, comments ] = this.#validateState( { projectName } )
        printMessages( { messages, comments } )

        this.#state['projectName'] = projectName
        return this
    }


    async newPersonas( { names=[ 'this', 'that' ] } ) {
        const [ messages, comments ] = this.#validateState( { names } )
        printMessages( { messages, comments } )

        const { accountGroup, projectName } = this.#state
        this.#environment.init( { accountGroup, projectName } )
        this.#environment.updateFolderStructure()

        const nameCmds = names
            .map( name => [ name, accountGroup ] )
        await this.#createMissingAccounts( { nameCmds, accountGroup } )

        return true
    }


    #detectSecret( { filePath=null } ) {
        let messages = []
        let comments = []

        const key = this.#config['secret']['key']

        if( filePath !== null ) {

        }


        if( Object.hasOwn( process.env, key ) ) {
            if( process.env[ key ] === undefined || process.env[ key ] === null ) {
                messages.push( `Environment variable '${key}' is not set as environment variable.` )
            } else if( typeof process.env[ key ] != 'string' ) {
                messages.push( `Environment variable '${key}' is not type of string.` )
            } else {
                const secret = process.env[ key ]
                const [ m, c ] = this.#encryption.validateSecret( { secret } ) 
                messages = [ ...messages, ...m ]
                comments = [ ...comments, ...c ]
            }
        } else {
            messages.push( `Environment variable '${key}' is not set.` )
        }

        console.log( 'Mesages', messages )
        process.exit( 1 )
        // console.log( 'test', test )
        return true
    }


    #addAccount() {
        const account = new Account( {
            'accounts': this.#config['accounts'],
            'networks': this.#config['networks'],
            'validate': this.#config['validate']
        } ) 

        return account
    }


    #addEnvironment() {
        const environment = new Environment( { 
            'validate': this.#config['validate'],
            'secret': this.#config['secret']
        } ) 

        return environment
    }


    async #createMissingAccounts( { nameCmds } ) {
        const availableDeyployers = this.#environment.getAccounts( { 'account': this.#account } )
        const missingNames = nameCmds
            .filter( a => {
                const [ name, accountGroup ] = a
                if( Object.hasOwn( availableDeyployers, accountGroup ) ) {
                    if( Object.hasOwn( availableDeyployers[ accountGroup ], name ) ) {
                        return false
                    } else {
                        return true
                    }
                } else {
                    return true
                }
            } )

        for( let i = 0; i < missingNames.length; i++ ) {
            const [ name, groupName ] = missingNames[ i ]
            console.log( 'Create', name )
            const deployer = await this.#createAccount( {
                name,
                groupName,
                'pattern': true,
                'networkNames': [ 'berkeley' ],
                'secret': 'EApex4z3ZzkciZzn8f2mmz1ml7wlwyfZ28ejZv2oZu',
                'encrypt': false,
                'account': this.#account
            } )

            let path = [
                this.#config['validate']['folders']['credentials']['name'],
                this.#config['validate']['folders']['credentials']['subfolders']['accounts']['name'],
                `${name}--${moment().unix()}.json`
            ]
                .join( '/' )
     
            fs.writeFileSync( 
                path, 
                JSON.stringify( deployer, null, 4 ), 
                'utf-8'
            )
        }

        return true
    }


    async #createAccount( { name, groupName, pattern, networkNames, secret, encrypt, account } ) {
        let deployer = await account
            .createDeployer( { name, groupName, pattern, networkNames } )

        this.#encryption.setSecret( { secret } )
        if( encrypt ) {
            deployer = this.#encryption.encryptDeployer( { deployer } )
        }
        
        return deployer
    }


    #validateState( { accountGroup=null, projectName=null, names=null } ) {
        const messages = []
        const comments = []
 
        const tests = []
        accountGroup !== null ? tests.push( [ accountGroup, 'accountGroup', 'stringsAndDash' ] ) : ''
        projectName !== null ? tests.push( [ projectName, 'projectName', 'stringsAndDash' ] ) : ''

        const tmp = tests
            .forEach( a => {
                const [ value, key, regexKey ] = a
                if( typeof value !== 'string' ) {
                    messages.push( `Key '${key}' is not type of string` )
                } else if( !this.#config['validate']['values'][ regexKey ]['regex'].test( value ) ) {
                    messages.push( `Key '${key}' with the value '${value}' has not the expected pattern. ${this.#config['validate']['values'][ regexKey ]['description']}` )
                }
            } )

        if( names === null ) {
            
        } else if( !Array.isArray( names ) ) {
            messages.push( `Key 'names' is not type of array.` )
        } else if( names.length === 0 ) {
            messages.push( `Key 'names' is empty` )
        } else {
            names
                .forEach( ( value, index ) => {
                    if( typeof value !== 'string' ) {
                        messages.push( `Key 'names' with the value '${value}' is not type of string.` )
                    } else if( !this.#config['validate']['values']['stringsAndDash']['regex'].test( value ) ) {
                        messages.push( `Key '${key}' with the value '${value}' has not the expected pattern. ${this.#config['validate']['values']['stringsAndDash']['description']}` )
                    }

                } )
        }

        return [ messages, comments ]
    }
}