<?php
/**
 * Plugin Name: WooCommerce AJAX Product Filters
 * Description: Adds custom AJAX filters (price, category, size, color, stock) for WooCommerce products.
 * Version: 1.1
 * Author: Mehedi Hasan
 * Author Link : https://github.com/Mehedi-Hasan4
 */

if (!defined('ABSPATH')) exit;

class WC_AJAX_Product_Filters {

    public function __construct() {
        add_action('wp_enqueue_scripts', [$this, 'enqueue_scripts']);
        add_shortcode('wc_custom_filters', [$this, 'render_filters']);
        add_action('wp_ajax_apply_product_filters', [$this, 'apply_filters']);
        add_action('wp_ajax_nopriv_apply_product_filters', [$this, 'apply_filters']);
        add_action('wp_ajax_get_price_range', [$this, 'get_price_range']);
        add_action('wp_ajax_nopriv_get_price_range', [$this, 'get_price_range']);
    }

    public function enqueue_scripts() {
        if (!is_shop() && !is_product_category() && !is_product_tag()) {
            return;
        }

        wp_enqueue_style('jquery-ui-slider', 'https://code.jquery.com/ui/1.12.1/themes/ui-lightness/jquery-ui.css');
        wp_enqueue_script('jquery-ui-slider');

        wp_enqueue_style('wc-custom-filters-style', plugin_dir_url(__FILE__) . 'style.css', [], '1.1');
        wp_enqueue_script('wc-custom-filters', plugin_dir_url(__FILE__) . 'filters.js', ['jquery', 'jquery-ui-slider'], '1.1', true);
        
        $price_range = $this->get_price_range_data();
        
        // Get current category ID
        $current_category = 0;
        if (is_product_category()) {
            $current_cat = get_queried_object();
            if ($current_cat && isset($current_cat->term_id)) {
                $current_category = $current_cat->term_id;
            }
        }
        
        wp_localize_script('wc-custom-filters', 'filterAjax', [
            'ajaxurl' => admin_url('admin-ajax.php'),
            'isMobile' => wp_is_mobile(),
            'nonce' => wp_create_nonce('filter_nonce'),
            'priceRange' => $price_range,
            'currentCategory' => $current_category,
        ]);
    }

    private function get_price_range_data($category_id = null) {
        global $wpdb;
        
        $sql = "SELECT MIN(CAST(pm.meta_value AS DECIMAL(10,2))) as min_price, 
                       MAX(CAST(pm.meta_value AS DECIMAL(10,2))) as max_price 
                FROM {$wpdb->postmeta} pm
                INNER JOIN {$wpdb->posts} p ON pm.post_id = p.ID 
                WHERE pm.meta_key = '_price' 
                AND pm.meta_value != ''
                AND p.post_type = 'product'
                AND p.post_status = 'publish'";
        
        $params = [];
        
        // If we have a category, filter by it
        if ($category_id) {
            $sql .= " AND p.ID IN (
                        SELECT tr.object_id 
                        FROM {$wpdb->term_relationships} tr
                        INNER JOIN {$wpdb->term_taxonomy} tt ON tr.term_taxonomy_id = tt.term_taxonomy_id
                        WHERE tt.taxonomy = 'product_cat' 
                        AND tt.term_id = %d
                      )";
            $params[] = $category_id;
        }
        
        if (!empty($params)) {
            $result = $wpdb->get_row($wpdb->prepare($sql, $params));
        } else {
            $result = $wpdb->get_row($sql);
        }
        
        return [
            'min' => $result && $result->min_price ? floor($result->min_price) : 0,
            'max' => $result && $result->max_price ? ceil($result->max_price) : 1000
        ];
    }

    public function get_price_range() {
        $category_id = isset($_POST['category_id']) ? intval($_POST['category_id']) : null;
        wp_send_json_success($this->get_price_range_data($category_id));
    }

    private function get_available_attributes($taxonomy, $category_id = null) {
        global $wpdb;
        
        $sql = "SELECT DISTINCT t.term_id, t.name, t.slug, COUNT(tr.object_id) as product_count
                FROM {$wpdb->terms} t
                INNER JOIN {$wpdb->term_taxonomy} tt ON t.term_id = tt.term_id
                INNER JOIN {$wpdb->term_relationships} tr ON tt.term_taxonomy_id = tr.term_taxonomy_id
                INNER JOIN {$wpdb->posts} p ON tr.object_id = p.ID
                WHERE tt.taxonomy = %s
                AND p.post_type = 'product'
                AND p.post_status = 'publish'";
        
        $params = [$taxonomy];
        
        if ($category_id) {
            $sql .= " AND p.ID IN (
                        SELECT tr2.object_id 
                        FROM {$wpdb->term_relationships} tr2
                        INNER JOIN {$wpdb->term_taxonomy} tt2 ON tr2.term_taxonomy_id = tt2.term_taxonomy_id
                        WHERE tt2.taxonomy = 'product_cat' 
                        AND tt2.term_id = %d
                      )";
            $params[] = $category_id;
        }
        
        $sql .= " GROUP BY t.term_id, t.name, t.slug ORDER BY t.name";
        
        return $wpdb->get_results($wpdb->prepare($sql, $params));
    }

    private function get_stock_status_counts($category_id = null) {
        global $wpdb;
        
        $sql = "SELECT pm.meta_value as stock_status, COUNT(*) as count
                FROM {$wpdb->postmeta} pm
                INNER JOIN {$wpdb->posts} p ON pm.post_id = p.ID
                WHERE pm.meta_key = '_stock_status'
                AND p.post_type = 'product'
                AND p.post_status = 'publish'";
        
        $params = [];
        
        if ($category_id) {
            $sql .= " AND p.ID IN (
                        SELECT tr.object_id 
                        FROM {$wpdb->term_relationships} tr
                        INNER JOIN {$wpdb->term_taxonomy} tt ON tr.term_taxonomy_id = tt.term_taxonomy_id
                        WHERE tt.taxonomy = 'product_cat' 
                        AND tt.term_id = %d
                      )";
            $params[] = $category_id;
        }
        
        $sql .= " GROUP BY pm.meta_value";
        
        if (!empty($params)) {
            $results = $wpdb->get_results($wpdb->prepare($sql, $params));
        } else {
            $results = $wpdb->get_results($sql);
        }
        
        $stock_counts = [
            'instock' => 0,
            'outofstock' => 0
        ];
        
        foreach ($results as $result) {
            if (isset($stock_counts[$result->stock_status])) {
                $stock_counts[$result->stock_status] = $result->count;
            }
        }
        
        return $stock_counts;
    }

    public function render_filters() {
        $current_cat = get_queried_object();
        $current_cat_id = null;
        
        if ($current_cat && is_product_category()) {
            $current_cat_id = $current_cat->term_id;
        }
        
        $price_range = $this->get_price_range_data($current_cat_id);
        $stock_counts = $this->get_stock_status_counts($current_cat_id);
        
        ob_start();
        ?>
        <div id="wc-custom-filters-container" data-current-category="<?php echo esc_attr($current_cat_id ?: 0); ?>">
            <div id="selected-filters" class="selected-filters-container" style="display:none;">
                <h4>Active Filters:</h4>
                <div id="active-filters-list"></div>
                <button id="clear-all-filters" style="display:none;">Clear All</button>
            </div>

            <div id="filter-sidebar">
                <!-- Price Filter -->
                <div id="filter-price" class="filter-group">
                    <h4>Price Range</h4>
                    <div class="price-inputs">
                        <input type="number" id="min_price" placeholder="Min" min="<?php echo $price_range['min']; ?>" max="<?php echo $price_range['max']; ?>" value="<?php echo $price_range['min']; ?>">
                        <span>-</span>
                        <input type="number" id="max_price" placeholder="Max" min="<?php echo $price_range['min']; ?>" max="<?php echo $price_range['max']; ?>" value="<?php echo $price_range['max']; ?>">
                    </div>
                    <div id="price-slider"></div>
                    <div class="price-display">
                        <span id="price-min-display">৳<?php echo $price_range['min']; ?></span>
                        <span id="price-max-display">৳<?php echo $price_range['max']; ?></span>
                    </div>
                </div>

                <!-- Stock Status Filter -->
                <div id="filter-stock" class="filter-group">
                    <h4>Stock Status</h4>
                    <div class="stock-filter-options">
                        <?php if ($stock_counts['instock'] > 0): ?>
                        <label class="filter-checkbox-label">
                            <input type="checkbox" name="stock[]" value="instock" data-name="In Stock"> 
                            In Stock (<?php echo $stock_counts['instock']; ?>)
                        </label>
                        <?php endif; ?>
                        
                        <?php if ($stock_counts['outofstock'] > 0): ?>
                        <label class="filter-checkbox-label">
                            <input type="checkbox" name="stock[]" value="outofstock" data-name="Out of Stock"> 
                            Out of Stock (<?php echo $stock_counts['outofstock']; ?>)
                        </label>
                        <?php endif; ?>
                    </div>
                </div>

                <!-- Category Filter -->
                <?php if ($current_cat && is_product_category()): ?>
                <div id="filter-category" class="filter-group">
                    <h4>Categories</h4>
                    <div class="category-filter-options">
                        <?php
                        $children = get_terms([
                            'taxonomy' => 'product_cat',
                            'parent' => $current_cat->term_id,
                            'hide_empty' => true,
                        ]);
                        
                        if (!empty($children)) {
                            $show_limit = 5;
                            foreach ($children as $index => $child) {
                                $hidden_class = $index >= $show_limit ? 'filter-item-hidden' : '';
                                echo '<label class="filter-checkbox-label ' . $hidden_class . '">';
                                echo '<input type="checkbox" name="categories[]" value="' . esc_attr($child->term_id) . '" data-name="' . esc_attr($child->name) . '"> ';
                                echo esc_html($child->name) . ' (' . $child->count . ')';
                                echo '</label>';
                            }
                            
                            if (count($children) > $show_limit) {
                                echo '<button class="see-more-btn" data-target="category">See More</button>';
                                echo '<button class="see-less-btn" data-target="category" style="display:none;">See Less</button>';
                            }
                        } else {
                            echo '<p>No subcategories available</p>';
                        }
                        ?>
                    </div>
                </div>
                <?php endif; ?>

                <!-- Size Filter -->
                <?php 
                $sizes = $this->get_available_attributes('pa_size', $current_cat_id);
                if (!empty($sizes)): 
                ?>
                <div id="filter-size" class="filter-group">
                    <h4>Size</h4>
                    <div class="size-filter-buttons">
                        <?php 
                        $show_limit = 5;
                        foreach ($sizes as $index => $size): 
                            $hidden_class = $index >= $show_limit ? 'filter-item-hidden' : '';
                        ?>
                            <button class="filter-button size-button <?php echo $hidden_class; ?>" 
                                    data-value="<?php echo esc_attr($size->slug); ?>" 
                                    data-name="<?php echo esc_attr($size->name); ?>"
                                    data-filter-type="size">
                                <?php echo esc_html($size->name); ?> (<?php echo $size->product_count; ?>)
                            </button>
                        <?php endforeach; ?>
                        
                        <?php if (count($sizes) > $show_limit): ?>
                            <button class="see-more-btn" data-target="size">See More</button>
                            <button class="see-less-btn" data-target="size" style="display:none;">See Less</button>
                        <?php endif; ?>
                    </div>
                    <input type="hidden" name="selected_sizes" id="selected-sizes" value="">
                </div>
                <?php endif; ?>

                <!-- Color Filter -->
                <?php 
                $colors = $this->get_available_attributes('pa_color', $current_cat_id);
                if (!empty($colors)): 
                ?>
                <div id="filter-color" class="filter-group">
                    <h4>Color</h4>
                    <div class="color-filter-buttons">
                        <?php 
                        $show_limit = 5;
                        foreach ($colors as $index => $color): 
                            $hidden_class = $index >= $show_limit ? 'filter-item-hidden' : '';
                        ?>
                            <button class="filter-button color-button <?php echo $hidden_class; ?>" 
                                    data-value="<?php echo esc_attr($color->slug); ?>" 
                                    data-name="<?php echo esc_attr($color->name); ?>"
                                    data-filter-type="color">
                                <span class="color-swatch" style="background-color: <?php echo esc_attr($color->slug); ?>;" title="<?php echo esc_attr($color->name); ?>"></span>
                                <span class="color-name"><?php echo esc_html($color->name); ?> (<?php echo $color->product_count; ?>)</span>
                            </button>
                        <?php endforeach; ?>
                        
                        <?php if (count($colors) > $show_limit): ?>
                            <button class="see-more-btn" data-target="color">See More</button>
                            <button class="see-less-btn" data-target="color" style="display:none;">See Less</button>
                        <?php endif; ?>
                    </div>
                    <input type="hidden" name="selected_colors" id="selected-colors" value="">
                </div>
                <?php endif; ?>
            </div>

            <div id="filter-loading" class="filter-loading" style="display:none;">
                <div class="loading-spinner"></div>
                <p>Loading products...</p>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }

    public function apply_filters() {
        // Verify nonce
        if (!wp_verify_nonce($_POST['nonce'], 'filter_nonce')) {
            wp_die('Security check failed');
        }

        $filters = isset($_POST['filters']) ? $_POST['filters'] : [];
        $paged = isset($_POST['paged']) ? intval($_POST['paged']) : 1;
        $current_category = isset($_POST['current_category']) ? intval($_POST['current_category']) : 0;

        $args = [
            'post_type' => 'product',
            'posts_per_page' => 12,
            'paged' => $paged,
            'post_status' => 'publish',
            'meta_query' => [
                'relation' => 'AND',
            ],
            'tax_query' => [
                'relation' => 'AND',
            ],
        ];

        // IMPORTANT: Always include the current category in the query
        if ($current_category > 0) {
            $args['tax_query'][] = [
                'taxonomy' => 'product_cat',
                'field' => 'term_id',
                'terms' => [$current_category],
                'operator' => 'IN',
                'include_children' => true, // This includes subcategories
            ];
        }

        // Price filter
        if (!empty($filters['price_min']) || !empty($filters['price_max'])) {
            $price_min = !empty($filters['price_min']) ? floatval($filters['price_min']) : 0;
            $price_max = !empty($filters['price_max']) ? floatval($filters['price_max']) : 999999;
            
            $args['meta_query'][] = [
                'key' => '_price',
                'value' => [$price_min, $price_max],
                'compare' => 'BETWEEN',
                'type' => 'NUMERIC'
            ];
        }

        // Stock status filter
        if (!empty($filters['stock']) && is_array($filters['stock'])) {
            $args['meta_query'][] = [
                'key' => '_stock_status',
                'value' => array_map('sanitize_text_field', $filters['stock']),
                'compare' => 'IN',
            ];
        }

        // Additional category filter (subcategories)
        if (!empty($filters['categories']) && is_array($filters['categories'])) {
            $args['tax_query'][] = [
                'taxonomy' => 'product_cat',
                'field' => 'term_id',
                'terms' => array_map('intval', $filters['categories']),
                'operator' => 'IN',
            ];
        }

        // Size filter
        if (!empty($filters['sizes']) && is_array($filters['sizes'])) {
            $args['tax_query'][] = [
                'taxonomy' => 'pa_size',
                'field' => 'slug',
                'terms' => array_map('sanitize_text_field', $filters['sizes']),
                'operator' => 'IN',
            ];
        }

        // Color filter
        if (!empty($filters['colors']) && is_array($filters['colors'])) {
            $args['tax_query'][] = [
                'taxonomy' => 'pa_color',
                'field' => 'slug',
                'terms' => array_map('sanitize_text_field', $filters['colors']),
                'operator' => 'IN',
            ];
        }

        // Debug log
        error_log('Filter args: ' . print_r($args, true));

        $query = new WP_Query($args);
        
        $response = [
            'products' => '',
            'found_posts' => $query->found_posts,
            'max_num_pages' => $query->max_num_pages,
            'current_page' => $paged,
            'current_category' => $current_category,
        ];

        if ($query->have_posts()) {
            ob_start();
            
            woocommerce_product_loop_start();
            
            while ($query->have_posts()) {
                $query->the_post();
                wc_get_template_part('content', 'product');
            }
            
            woocommerce_product_loop_end();
            
            $response['products'] = ob_get_clean();
        } else {
            $response['products'] = '<div class="no-products-found"><p>No products found matching your criteria.</p></div>';
        }

        wp_reset_postdata();
        wp_send_json_success($response);
    }
}

new WC_AJAX_Product_Filters();