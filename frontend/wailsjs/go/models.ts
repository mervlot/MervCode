export namespace main {
	
	export class AdbDevice {
	    serial: string;
	    state: string;
	    model: string;
	    manufacturer: string;
	    brand: string;
	    product: string;
	    device: string;
	    android: string;
	    sdk: string;
	    transportId: string;
	
	    static createFrom(source: any = {}) {
	        return new AdbDevice(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.serial = source["serial"];
	        this.state = source["state"];
	        this.model = source["model"];
	        this.manufacturer = source["manufacturer"];
	        this.brand = source["brand"];
	        this.product = source["product"];
	        this.device = source["device"];
	        this.android = source["android"];
	        this.sdk = source["sdk"];
	        this.transportId = source["transportId"];
	    }
	}
	export class ToolStatus {
	    languageInstalled: boolean;
	    toolsInstalled: boolean;
	    missingTools: string[];
	    languageBinary: string;
	    installCommand: string;
	
	    static createFrom(source: any = {}) {
	        return new ToolStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.languageInstalled = source["languageInstalled"];
	        this.toolsInstalled = source["toolsInstalled"];
	        this.missingTools = source["missingTools"];
	        this.languageBinary = source["languageBinary"];
	        this.installCommand = source["installCommand"];
	    }
	}

}

export namespace types {
	
	export class FileItem {
	    name: string;
	    path: string;
	    isDir: boolean;
	    children?: FileItem[];
	
	    static createFrom(source: any = {}) {
	        return new FileItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.path = source["path"];
	        this.isDir = source["isDir"];
	        this.children = this.convertValues(source["children"], FileItem);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class FileResponse {
	    category: string;
	    content: string;
	
	    static createFrom(source: any = {}) {
	        return new FileResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.category = source["category"];
	        this.content = source["content"];
	    }
	}
	export class GitFileStatus {
	    path: string;
	    rel: string;
	    status: string;
	
	    static createFrom(source: any = {}) {
	        return new GitFileStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.rel = source["rel"];
	        this.status = source["status"];
	    }
	}
	export class GitStatusResult {
	    isRepo: boolean;
	    branch: string;
	    files: GitFileStatus[];
	
	    static createFrom(source: any = {}) {
	        return new GitStatusResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.isRepo = source["isRepo"];
	        this.branch = source["branch"];
	        this.files = this.convertValues(source["files"], GitFileStatus);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class SearchMatch {
	    path: string;
	    line: number;
	    column: number;
	    preview: string;
	
	    static createFrom(source: any = {}) {
	        return new SearchMatch(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.line = source["line"];
	        this.column = source["column"];
	        this.preview = source["preview"];
	    }
	}

}

