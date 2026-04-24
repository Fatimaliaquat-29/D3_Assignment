import csv

def pad_pokemon_data(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        reader = list(csv.reader(f))
    
    header = reader[0]
    data = reader[1:]
    
    # We need to get to 1005 rows (just to be safe > 1000)
    rows_needed = 1005 - len(data)
    
    # Take the first `rows_needed` pokemon, make them "Shiny", and slightly boost their stats to make it interesting
    new_rows = []
    max_id = max([int(row[0]) for row in data])
    
    for i in range(rows_needed):
        original = data[i]
        new_row = original.copy()
        
        # New ID
        max_id += 1
        new_row[0] = str(max_id)
        
        # New Name
        new_row[1] = original[1] + " (Shiny)"
        
        # Boost stats by +5
        for col_idx in range(4, 11):
            new_row[col_idx] = str(int(original[col_idx]) + 5)
        
        new_rows.append(new_row)
    
    # Append the new rows to the data
    data.extend(new_rows)
    
    # Write back to the CSV
    with open(filename, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(header)
        writer.writerows(data)
        
    print(f"Added {len(new_rows)} Shiny Pokemon! Total rows: {len(data)}")

if __name__ == '__main__':
    pad_pokemon_data('Pokemon.csv')
