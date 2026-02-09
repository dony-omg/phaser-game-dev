import { PhaserGame } from './PhaserGame';

type AppProps = {
    gameCode?: string;
};

function App({ gameCode }: AppProps)
{
    return (
        <div id="app">
            <PhaserGame gameCode={gameCode} />
        </div>
    )
}

export default App
