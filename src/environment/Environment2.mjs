import fs from 'fs'
import { keyPathToValue } from './../helpers/mixed.mjs'
import { printMessages } from './../helpers/mixed.mjs'


export class Environment {
    #config
    #state


    constructor( { validate, secret, typescript } ) {
        this.#config = { validate, secret, typescript }
        return true
    }


    init( { accountGroup, projectName } ) {
        this.#state = {
            accountGroup,
            projectName
        }

        return true
    }


    updateFolderStructure() {
        const tmp = [
            [ 
                [ 'validate__folders__credentials__name', 'config' ]
            ],
            [ 
                [ 'validate__folders__credentials__name', 'config' ],
                [ 'validate__folders__credentials__subfolders__accounts__name', 'config' ]
            ],
            [
                [ 'validate__folders__credentials__name', 'config' ],
                [ 'validate__folders__credentials__subfolders__contracts__name', 'config' ] 
            ],
            [
                [ 'validate__folders__workdir__name', 'config' ]
            ],
            [
                [ 'validate__folders__workdir__name', 'config' ],
                [ 'projectName', 'state' ]
            ],
            [
                [ 'validate__folders__workdir__name', 'config' ],
                [ 'projectName', 'state' ],
                [ 'validate__folders__workdir__subfolders__subfolders__backend__name', 'config' ]
            ],
            [
                [ 'validate__folders__workdir__name', 'config' ],
                [ 'projectName', 'state' ],
                [ 'validate__folders__workdir__subfolders__subfolders__frontend__name', 'config' ]
            ]
        ]
            .forEach( cmds => {
                const path = cmds
                    .map( cmd => {
                        const [ keyPath, type ] = cmd
                        let value = ''
                        switch( type ) {
                            case 'config': 
                                value = keyPathToValue( { 'data': this.#config, keyPath } )
                                break
                            case 'state':
                                value = keyPathToValue( { 'data': this.#state, keyPath } )
                                break
                            default:
                                console.log( 'Something went wrong!' )
                                process.exit( 1 )
                                break
                        }
                        return value
                    } )
                    .join( '/' )

                if( !fs.existsSync( path ) ) {
                    fs.mkdirSync( path )
                }
            } )

        return true
    }


    getSecret( { filePath=null, encryption } ) {
        const [ messages, comments ] = this.#validateGetSecret( { filePath } )
        printMessages( { messages, comments } )

        filePath = this.#chooseSecretFilePathRoute( { filePath } )

        const [ m, c ] = this.#validateSecretFilePath( { filePath, encryption } )
        printMessages( { 'messages': m, 'comments': c } )

        const result = this.#loadSecretFromFilePath( { filePath } )
        return result
    }


    createSecretFile( { encryption } ) {
        const filePath = [
            this.#config['validate']['folders']['credentials']['name'],
            this.#config['secret']['fileName']
        ]
            .join( '/' )

        const txt = [
            this.#config['secret']['key'],
            encryption.createSecretValue()
        ]
            .join( '=' )

        fs.writeFileSync( path, txt, 'utf-8' )

        return true
    }


    getAccounts( { account, encrypt } ) {
        const path = [ 
            'validate__folders__credentials__name',
            'validate__folders__credentials__subfolders__accounts__name'
        ]
            .map( keyPath => keyPathToValue( { 'data': this.#config, keyPath } ) )
            .join( '/' )
  
        const result = fs.readdirSync( path )
            .reduce( ( abb, file ) => {
                const filePath = `${path}/${file}`
                if( !fs.statSync( filePath ).isDirectory() ) {
                    if( filePath.endsWith( '.json' ) ) {
                        const [ messages, comments ] = account
                            .validateDeployer( { filePath, encrypt } )
                        if( messages.length === 0 ) {
                            const tmp = fs.readFileSync( filePath, 'utf-8' )
                            const json = JSON.parse( tmp )
                            if( json['header']['encrypt'] ) {
                                json['body'] = JSON.parse( encrypt.decrypt( { 'hash': json['body'] } ) )
                            }

                            const struct = {
                                filePath, 
                                ...json['header']
                            }

                            abb.push( struct )
                        }
                    }
                }
                return abb
            }, [] )
            .reduce( ( abb, item ) => {
                const { groupName } = item
                !Object.hasOwn( abb, groupName ) ? abb[ groupName ] = {} : ''

                let key = item['name']
                if( Object.hasOwn( abb[ groupName ], item['name'] ) ) {
                    key += '-'
                    key += Object
                        .keys( abb[ groupName ] )
                        .filter( a => a.startsWith( key ) )
                        .length + 1
                }

                abb[ groupName ][ key ] = item

                return abb
            }, {} )
        return result
    }


    getProjectNames() {
        const workdir = this.#config['validate']['folders']['workdir']['name']
        const projectNames = fs
            .readdirSync( workdir )
            .filter( item => {
                const path = `${workdir}/${item}`
                return fs.statSync( path ).isDirectory()
            } )
            .filter( ( v, i, a ) => a.indexOf( v ) === i )

        return projectNames
    }


    getContracts() {
        const projectNames = this.getProjectNames()
        const result = projectNames
            .reduce( ( acc, projectName, index ) => {
                acc[ projectName ] = this.#getContractsByProjectName( { 
                    projectName 
                } )
                return acc
            }, {} )

        return result
    }


    #getContractsByProjectName( { projectName } ) {
        const pathContracts = [
            this.#config['validate']['folders']['workdir']['name'],
            projectName,
            this.#config['validate']['folders']['workdir']['subfolders']['subfolders']['contracts']['name']
        ]
            .join( '/' )

        let pathBuilds = ''
        pathBuilds += `${pathContracts}/`
        pathBuilds += this.#config['typescript']['buildFolderName']

        const cmds = [
            [ pathContracts, '.ts', 'ts' ],
            [ pathBuilds, '.js', 'js' ]
        ]

        const contracts = cmds
            .reduce( ( acc, a, index ) => {
                const [ path, search, key ] = a 
                fs
                    .readdirSync( path )
                    .filter( file => {
                        const stats = fs.statSync( `${path}/${file}` )
                        return stats.isFile()
                    } )
                    .forEach( file => {
                        if( file.endsWith( search ) ) {
                            const id = file.split( search )[ 0 ]
                            if( !Object.hasOwn( acc, id ) ) {
                                acc[ id ] = {}
                                cmds.forEach( a => acc[ id ][ a[ 2 ] ] = '' )
                            }

                            acc[ id ][ key ] =  `${path}/${file}`
                        }
                    } )
                return acc
            }, {} )

        return contracts
    }


    #loadSecretFromFilePath( { filePath } ) {
        const rows = fs.readFileSync( filePath, 'utf-8' )
            .split( "\n" )

        const rowIndex = rows
            .findIndex( a => a.startsWith( this.#config['secret']['key'] ) )

        const secret = rows[ rowIndex ]
            .split( '=' )[ 1 ]

        return secret
    }


    #chooseSecretFilePathRoute( { filePath } ) {
        if( filePath === null ) {
            filePath = [
                this.#config['validate']['folders']['credentials']['name'],
                this.#config['secret']['fileName']
            ]
                .join( '/' )
        }

        return filePath
    }


    #validateSecretFilePath( { filePath, encryption } ) {
        let messages = []
        let comments = []

        try {
            fs.accessSync( filePath, fs.constants.F_OK )
        } catch ( err ) {
            messages.push( `Secret .env file '${filePath}' does not exist.` )
        }

        if( messages.length === 0 ) {
            const tmp = fs.readFileSync( filePath, 'utf-8' )
            const rows = tmp
                .split( "\n" )

            const rowIndex = rows
                .findIndex( a => a.startsWith( this.#config['secret']['key'] ) )

            if( rowIndex === -1 ) {
                messages.push( `Secret .env does not start with key '${this.#config['secret']['key']}'.` )
            } else if( !rows[ rowIndex ].includes( '=' ) ) {
                messages.push( `Secret .env starts with key '${this.#config['secret']['key']}' splitter '=' is missing.` )
            } else {
                const value = rows[ rowIndex ].split( '=' )[ 1 ]
                if( value === '' ) {
                    messages.push( `Secret .env contains key '${this.#config['secret']['key']}' but value is ''.` )
                } else {
                    const [ m, c ] = encryption.validateSecret( { 'secret': value } )
                    messages = [ ...messages, ...m ]
                }
            }
        }

        return [ messages, comments ]
    }


    #validateGetSecret( { filePath } ) {
        const messages = []
        const comments = []

        if( typeof filePath !== 'string' && filePath !== null ) {
            messages.push( `Key 'filePath' is not type of 'string' or 'null'.` )
        }

        return [ messages, comments ]
    }
}