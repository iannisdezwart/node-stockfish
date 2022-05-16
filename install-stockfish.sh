if [ ! -d "Stockfish" ]; then
	git clone https://github.com/official-stockfish/Stockfish
	cd Stockfish/src && make build
fi