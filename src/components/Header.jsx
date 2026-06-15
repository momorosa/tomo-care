export default function Header() {
    return(
        <header className="bg-tomo-bg border-b border-tomo-border">
            <div className="container mx-auto px-4 py-6">
                <div className="flex items-center">
                    <img src="/assets/tomocare-logo.png" alt="TomoCare" className="h-10 w-10 mr-2"/>
                    <h1 className="text-xl font-bold text-tomo-text-h font-primary">
                        TomoCare
                    </h1>
                </div>
            </div>
        </header>
    )
}
